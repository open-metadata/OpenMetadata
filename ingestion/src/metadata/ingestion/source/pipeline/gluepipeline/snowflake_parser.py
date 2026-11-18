#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Snowflake reads and writes in AWS Glue job scripts, extracted from Python ASTs
using the shared `script_evaluator` binding and expression engine.
"""

import ast
import re
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal

from metadata.ingestion.source.pipeline.gluepipeline.script_evaluator import (
    ABSENT,
    MAX_EXPR_DEPTH,
    MAX_LOOP_UNROLLS,
    OPAQUE,
    SPARK_TERMINAL_PARAMETERS,
    UNKNOWN,
    ParameterContext,
    ParsedScript,
    ScriptReader,
    build_execution_slices,
    parse_python_script,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

__all__ = [
    "MAX_EXPR_DEPTH",
    "MAX_LOOP_UNROLLS",
    "SNOWFLAKE_FORMATS",
    "ParameterContext",
    "SnowflakeDirection",
    "SnowflakeRef",
    "extract_snowflake_call",
    "parse_snowflake_refs",
    "script_wide_snowflake_values",
]

SnowflakeDirection = Literal["sources", "targets"]

SNOWFLAKE_FORMATS = {"snowflake", "net.snowflake.spark.snowflake"}

DBTABLE, SF_DATABASE, SF_SCHEMA = "dbtable", "sfdatabase", "sfschema"
REF_KEYS = (DBTABLE, SF_DATABASE, SF_SCHEMA)

GLUE_FROM_OPTIONS: dict[str, tuple[SnowflakeDirection, tuple[str, ...]]] = {
    "create_dynamic_frame": ("sources", ("connection_type", "connection_options")),
    "write_dynamic_frame": ("targets", ("frame", "connection_type", "connection_options")),
}
GLUE_FLAT_FROM_OPTIONS: dict[str, tuple[SnowflakeDirection, tuple[str, ...]]] = {
    "create_dynamic_frame_from_options": GLUE_FROM_OPTIONS["create_dynamic_frame"],
    "write_dynamic_frame_from_options": GLUE_FROM_OPTIONS["write_dynamic_frame"],
}
SPARK_DIRECTIONS: dict[tuple[str, str], SnowflakeDirection] = {
    ("read", "load"): "sources",
    ("write", "save"): "targets",
}

# Snowflake identifiers: "ORDERS.V2" is one quoted name, FINANCE.CURATED.ORDERS are three
QUALIFIED_NAME_PART_PATTERN = re.compile(r'"[^"]*"|[^.]+')


@dataclass(frozen=True)
class SnowflakeRef:
    table: str
    database: str | None = None
    schema: str | None = None


def parse_snowflake_refs(
    source_code: str,
    context: ParameterContext | None = None,
) -> tuple[list[SnowflakeRef], list[SnowflakeRef]]:
    """Snowflake (sources, targets) of a Glue script, in source order; none when it does not parse."""
    parsed = parse_python_script(source_code)
    if parsed is None:
        return [], []
    try:
        return _find_snowflake_refs(parsed, context=context)
    except RecursionError as exc:
        logger.debug("Glue script exceeded recursion limit during Snowflake lineage analysis: %s", exc)
        return [], []


def _find_snowflake_refs(
    parsed: ParsedScript,
    context: ParameterContext | None = None,
) -> tuple[list[SnowflakeRef], list[SnowflakeRef]]:
    slices = build_execution_slices(parsed.tree, context=context, bindings=parsed.bindings)
    fallback = script_wide_snowflake_values(parsed.literal_pairs)
    found: dict[SnowflakeDirection, list[SnowflakeRef]] = {"sources": [], "targets": []}
    seen_per_call: set[tuple[int, SnowflakeDirection, SnowflakeRef]] = set()
    for call in parsed.calls:
        for slc in slices:
            if not slc.call_included(call, parsed.bindings):
                continue
            extracted = extract_snowflake_call(call, slc.reader, fallback)
            if extracted is None:
                continue
            direction, ref = extracted
            if ref is not None:
                key = (id(call), direction, ref)
                if key not in seen_per_call:
                    seen_per_call.add(key)
                    found[direction].append(ref)
                    logger.debug("Found Snowflake %s: %s", direction, ref)
    return found["sources"], found["targets"]


def extract_snowflake_call(
    call: ast.Call,
    reader: ScriptReader,
    fallback: dict[str, str],
) -> tuple[SnowflakeDirection, SnowflakeRef | None] | None:
    """
    If `call` is a Spark or GlueContext Snowflake read/write, return `(direction, ref_or_none)`.
    Returns `None` when `call` is not a Snowflake read/write.
    """
    match = _spark_snowflake_call(call, reader) or _glue_snowflake_call(call, reader)
    if match is None:
        return None
    direction, settings = match
    return direction, _build_ref(_apply(settings), fallback)


def _spark_snowflake_call(
    call: ast.Call, reader: ScriptReader
) -> tuple[SnowflakeDirection, list[tuple[object, object]]] | None:
    if not isinstance(call.func, ast.Attribute):
        return None
    chain: list[ast.Call] = []
    node: ast.expr = call.func.value
    while isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        chain.append(node)
        node = node.func.value
    direction = SPARK_DIRECTIONS.get((node.attr, call.func.attr)) if isinstance(node, ast.Attribute) else None
    if not direction:
        return None

    spark_format: object = None
    settings: list[tuple[object, object]] = []
    for step in reversed(chain):
        method = step.func.attr  # type: ignore[union-attr]
        if method == "format" and step.args:
            spark_format = reader.string(step.args[0])
        elif method == "option":
            settings.append(reader.option_setting(step))
        elif method == "options":
            settings.extend(reader.keyword_settings(step.keywords))
    for keyword in call.keywords:
        if keyword.arg == "format":
            spark_format = reader.string(keyword.value)
    settings.extend(
        reader.keyword_settings([keyword for keyword in call.keywords if keyword.arg not in SPARK_TERMINAL_PARAMETERS])
    )
    is_snowflake = isinstance(spark_format, str) and spark_format.lower() in SNOWFLAKE_FORMATS
    return (direction, settings) if is_snowflake else None


def _glue_snowflake_call(
    call: ast.Call, reader: ScriptReader
) -> tuple[SnowflakeDirection, list[tuple[object, object]]] | None:
    func = call.func
    if not isinstance(func, ast.Attribute):
        return None
    spec = GLUE_FLAT_FROM_OPTIONS.get(func.attr)
    if func.attr == "from_options" and isinstance(func.value, ast.Attribute):
        spec = GLUE_FROM_OPTIONS.get(func.value.attr)
    if not spec:
        return None

    direction, positional = spec
    arguments = dict(zip(positional, call.args, strict=False))
    arguments.update({keyword.arg: keyword.value for keyword in call.keywords if keyword.arg})
    connection_type = reader.string(arguments.get("connection_type"))
    if not (isinstance(connection_type, str) and connection_type.lower() == "snowflake"):
        return None
    options = arguments.get("connection_options")
    return direction, (reader.settings(options) if options is not None else [])


def _apply(settings: list[tuple[object, object]]) -> dict[str, object]:
    options: dict[str, object] = {}
    for key, value in settings:
        if key is OPAQUE:
            options.update(dict.fromkeys(REF_KEYS, UNKNOWN))
        elif isinstance(key, str):
            options[key] = value
    return options


def _build_ref(options: dict[str, object], fallback: dict[str, str]) -> SnowflakeRef | None:
    table = options.get(DBTABLE)
    if not isinstance(table, str) or not table:
        return None
    database, schema = options.get(SF_DATABASE, ABSENT), options.get(SF_SCHEMA, ABSENT)
    parts = [part.strip('"') for part in QUALIFIED_NAME_PART_PATTERN.findall(table)]
    if len(parts) == 3:
        database, schema, table = parts
    elif len(parts) == 2:
        schema, table = parts
    elif len(parts) == 1:
        table = parts[0]
    else:
        return None
    # ADR:2026-10-22-glue-snowflake-refs-with-unknown-schema-link-only-unique-tables
    return SnowflakeRef(
        table=table,
        database=_known(database, fallback.get(SF_DATABASE)),
        schema=_known(schema, fallback.get(SF_SCHEMA)),
    )


def _known(value: object, fallback: str | None) -> str | None:
    if value is ABSENT:
        return fallback
    return value if isinstance(value, str) else None


def script_wide_snowflake_values(literal_pairs: Iterable[tuple[str | None, str | None]]) -> dict[str, str]:
    """
    sfDatabase / sfSchema string literals anywhere in the script, used only when a
    call omits that key and the script contains a single unambiguous literal value.
    """
    values: dict[str, set[str]] = {SF_DATABASE: set(), SF_SCHEMA: set()}
    for key, value in literal_pairs:
        if key and key.lower() in values and value is not None:
            values[key.lower()].add(value)
    return {key: next(iter(found)) for key, found in values.items() if len(found) == 1}
