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
Lineage of AWS Glue PySpark/GlueContext scripts.

Python scripts are parsed once into an AST so GlueContext DynamicFrame, Spark
DataFrame, and Snowflake calls resolve literals, intermediate variables,
getResolvedOptions(...), get_workflow_run_properties(...), string formatting,
lookup dicts, and bounded constant loops per execution context. Non-Python or
syntactically incomplete scripts fall back to template-guarded regular
expressions for S3, Glue Catalog, and JDBC references.
"""

import ast
import re
from dataclasses import dataclass, field

from cachetools import LRUCache

from metadata.ingestion.source.pipeline.gluepipeline.snowflake_parser import (
    OPAQUE,
    SNOWFLAKE_FORMATS,
    SPARK_TERMINAL_PARAMETERS,
    ParameterContext,
    SnowflakeRef,
    _apply,
    _Bindings,
    _build_execution_slices,
    _build_ref,
    _call_in_excluded_loop,
    _DictValue,
    _glue_snowflake_call,
    _option_setting,
    _script_wide_values,
    _ScriptReader,
    _spark_snowflake_call,
    parse_snowflake_refs,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

__all__ = [
    "CatalogRef",
    "JDBCRef",
    "ParameterContext",
    "ScriptLineageResult",
    "SnowflakeRef",
    "parse_glue_script",
    "parse_glue_script_slices",
    "parse_snowflake_refs",
]

PARSED_AST_CACHE_SIZE = 64
S3_PREFIXES = ("s3://", "s3a://", "s3n://")
JDBC_CONNECTION_TYPES = {"jdbc", "mysql", "postgresql", "oracle", "redshift", "sqlserver", "dynamodb"}
SPARK_FILE_METHODS = {"load", "json", "parquet", "csv", "orc", "avro", "text"}
SPARK_WRITE_FILE_METHODS = {"save", "json", "parquet", "csv", "orc", "avro", "text"}

# Uninterpolated format/f-string/percent/Scala template markers skipped by regex fallbacks
UNRESOLVED_TEMPLATE_PATTERN = re.compile(r"\{[^{}]*\}|%[sd]|%\([^)]+\)[sd]|\$[A-Za-z_{]")

# --- Regex Fallbacks for Non-Python / Unparseable Scripts ---

FROM_CATALOG_PATTERN = re.compile(
    r"create_dynamic_frame\.from_catalog\s*\((.*?)\)",
    re.DOTALL,
)
FROM_OPTIONS_PATTERN = re.compile(
    r"create_dynamic_frame\.from_options\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)
WRITE_JDBC_CONF_PATTERN = re.compile(
    r"write_dynamic_frame\.from_jdbc_conf\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)
WRITE_OPTIONS_PATTERN = re.compile(
    r"write_dynamic_frame\.from_options\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)
WRITE_CATALOG_PATTERN = re.compile(
    r"write_dynamic_frame\.from_catalog\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)
PURGE_TABLE_PATTERN = re.compile(
    r"purge_table\s*\((.*?)\)\s*$",
    re.DOTALL | re.MULTILINE,
)
SPARK_READ_FORMAT_PATTERN = re.compile(
    r"\.read\.(?:load|json|parquet|csv|orc|avro)\s*\(\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)
SPARK_READ_FORMAT_LOAD_PATTERN = re.compile(
    r"\.read\.format\s*\([\"'][^\"']+[\"']\).*?\.load\s*\(\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)
SPARK_READ_JDBC_PATTERN = re.compile(
    r"\.read\.jdbc\s*\(\s*[\"']?([^\"',]+)[\"']?\s*,\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)
SPARK_READ_TABLE_PATTERN = re.compile(
    r"\.(?:read\.table|table)\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
)
SPARK_WRITE_FORMAT_PATTERN = re.compile(
    r"\.write\.(?:parquet|json|csv|orc|avro)\s*\(\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)
SPARK_WRITE_FORMAT_SAVE_PATTERN = re.compile(
    r"\.write\.format\s*\([\"'][^\"']+[\"']\).*?\.save\s*\(\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)
SPARK_WRITE_JDBC_PATTERN = re.compile(
    r"\.write\.jdbc\s*\(\s*[\"']?([^\"',]+)[\"']?\s*,\s*[\"']([^\"']+)[\"']",
    re.DOTALL,
)
SPARK_WRITE_SAVEASTABLE_PATTERN = re.compile(
    r"\.write\.saveAsTable\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
)
SPARK_WRITE_INSERTINTO_PATTERN = re.compile(
    r"\.write\.insertInto\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
)
S3_PATH_PATTERN = re.compile(r"s3[an]?://[^\s\"',\]]+")


@dataclass(frozen=True)
class _ParsedScript:
    tree: ast.Module
    bindings: _Bindings
    fallback: dict[str, str]
    calls: tuple[ast.Call, ...]


_PARSED_SCRIPT_CACHE: LRUCache[str, _ParsedScript] = LRUCache(maxsize=PARSED_AST_CACHE_SIZE)


def _is_resolved_text(value: str | None) -> bool:
    return bool(value) and not UNRESOLVED_TEMPLATE_PATTERN.search(value) and "{" not in value and "}" not in value


def _is_s3_uri(value: str | None) -> bool:
    return bool(value) and value.startswith(S3_PREFIXES) and _is_resolved_text(value)


def _extract_kwarg(block: str, key: str) -> str | None:
    pattern = re.compile(rf'{key}\s*=\s*["\']([^"\']+)["\']')
    match = pattern.search(block)
    val = match.group(1) if match else None
    return val if _is_resolved_text(val) else None


def _extract_dict_value(block: str, key: str) -> str | None:
    pattern = re.compile(rf'["\']?{key}["\']?\s*:\s*["\']([^"\']+)["\']')
    match = pattern.search(block)
    val = match.group(1) if match else None
    return val if _is_resolved_text(val) else None


def _extract_s3_paths(block: str) -> list[str]:
    return [p for p in dict.fromkeys(S3_PATH_PATTERN.findall(block)) if _is_s3_uri(p)]


def _is_snowflake(connection_type: str | None) -> bool:
    return bool(connection_type) and connection_type.lower() == "snowflake"


@dataclass(frozen=True)
class CatalogRef:
    database: str
    table: str


@dataclass(frozen=True)
class JDBCRef:
    connection_name: str | None = None
    jdbc_url: str | None = None
    database: str | None = None
    table: str | None = None


@dataclass
class ScriptLineageResult:
    s3_sources: list[str] = field(default_factory=list)
    s3_targets: list[str] = field(default_factory=list)
    catalog_sources: list[CatalogRef] = field(default_factory=list)
    catalog_targets: list[CatalogRef] = field(default_factory=list)
    jdbc_sources: list[JDBCRef] = field(default_factory=list)
    jdbc_targets: list[JDBCRef] = field(default_factory=list)
    snowflake_sources: list[SnowflakeRef] = field(default_factory=list)
    snowflake_targets: list[SnowflakeRef] = field(default_factory=list)
    has_source_calls: bool = False
    has_target_calls: bool = False

    @property
    def has_lineage(self) -> bool:
        return bool(
            self.s3_sources
            or self.s3_targets
            or self.catalog_sources
            or self.catalog_targets
            or self.jdbc_sources
            or self.jdbc_targets
            or self.snowflake_sources
            or self.snowflake_targets
        )

    def _item_count(self) -> int:
        return (
            len(self.s3_sources)
            + len(self.s3_targets)
            + len(self.catalog_sources)
            + len(self.catalog_targets)
            + len(self.jdbc_sources)
            + len(self.jdbc_targets)
            + len(self.snowflake_sources)
            + len(self.snowflake_targets)
        )


def _get_parsed_script(source_code: str) -> _ParsedScript | None:
    if source_code in _PARSED_SCRIPT_CACHE:
        return _PARSED_SCRIPT_CACHE[source_code]
    try:
        tree = ast.parse(source_code)
        bindings = _Bindings(tree)
        fallback = _script_wide_values(tree)
        calls = tuple(
            sorted(
                (node for node in ast.walk(tree) if isinstance(node, ast.Call)),
                key=lambda node: (node.lineno, node.col_offset),
            )
        )
    except (SyntaxError, ValueError, RecursionError) as exc:
        logger.debug("Glue script could not be parsed as Python AST, falling back to regex: %s", exc)
        return None
    parsed = _ParsedScript(tree=tree, bindings=bindings, fallback=fallback, calls=calls)
    _PARSED_SCRIPT_CACHE[source_code] = parsed
    return parsed


def parse_glue_script_slices(
    source_code: str | None,
    context: ParameterContext | None = None,
) -> list[ScriptLineageResult]:
    """
    Parse a Glue script into one or more correlated ScriptLineageResult slices
    (one per constant-loop iteration when unrollable, or a single result).
    """
    if not source_code:
        return []

    parsed = _get_parsed_script(source_code)
    if parsed is None:
        fallback_result = _parse_with_regex_fallback(source_code)
        return [fallback_result] if fallback_result.has_lineage else []

    slices = _build_execution_slices(parsed.tree, context=context, bindings=parsed.bindings)
    active_loops = {slc.active_top_loop for slc in slices if slc.active_top_loop is not None}
    multi_top_loops = len(active_loops) > 1
    results: list[ScriptLineageResult] = []
    for slc in slices:
        slice_result = ScriptLineageResult()
        active_loop_resolved = False
        for call in parsed.calls:
            if _call_in_excluded_loop(call, parsed.bindings, slc.excluded_loops):
                continue
            before_count = slice_result._item_count()
            _extract_ast_call(call, slc.reader, parsed.fallback, slice_result)
            if (
                slc.active_top_loop is not None
                and slice_result._item_count() > before_count
                and slc.active_top_loop in parsed.bindings.enclosing_for_loops(call)
            ):
                active_loop_resolved = True
        if multi_top_loops and slc.active_top_loop is not None and not active_loop_resolved:
            continue
        if slice_result.has_lineage:
            results.append(slice_result)
    return results


def parse_glue_script(
    source_code: str | None,
    context: ParameterContext | None = None,
) -> ScriptLineageResult:
    result = ScriptLineageResult()
    if not source_code:
        return result

    parsed = _get_parsed_script(source_code)
    if parsed is None:
        return _parse_with_regex_fallback(source_code)

    slices = _build_execution_slices(parsed.tree, context=context, bindings=parsed.bindings)
    seen_call_items: set[tuple[int, str, object]] = set()

    for call in parsed.calls:
        for slc in slices:
            if _call_in_excluded_loop(call, parsed.bindings, slc.excluded_loops):
                continue
            call_result = ScriptLineageResult()
            _extract_ast_call(call, slc.reader, parsed.fallback, call_result)
            _merge_call_result(id(call), call_result, result, seen_call_items)

    logger.debug(
        "Script lineage result: s3_sources=%s, s3_targets=%s, catalog_sources=%d, catalog_targets=%d, "
        "jdbc_sources=%d, jdbc_targets=%d, snowflake_sources=%d, snowflake_targets=%d",
        result.s3_sources,
        result.s3_targets,
        len(result.catalog_sources),
        len(result.catalog_targets),
        len(result.jdbc_sources),
        len(result.jdbc_targets),
        len(result.snowflake_sources),
        len(result.snowflake_targets),
    )
    return result


def _merge_call_result(
    call_id: int,
    call_result: ScriptLineageResult,
    target: ScriptLineageResult,
    seen_call_items: set[tuple[int, str, object]],
) -> None:
    target.has_source_calls = target.has_source_calls or call_result.has_source_calls
    target.has_target_calls = target.has_target_calls or call_result.has_target_calls
    for path in call_result.s3_sources:
        if path not in target.s3_sources:
            target.s3_sources.append(path)
    for path in call_result.s3_targets:
        if path not in target.s3_targets:
            target.s3_targets.append(path)
    for field_name in (
        "catalog_sources",
        "catalog_targets",
        "jdbc_sources",
        "jdbc_targets",
        "snowflake_sources",
        "snowflake_targets",
    ):
        for item in getattr(call_result, field_name):
            key = (call_id, field_name, item)
            if key not in seen_call_items:
                seen_call_items.add(key)
                getattr(target, field_name).append(item)


# --- AST Extraction for GlueContext, Spark DataFrame, and Snowflake ---


def _call_args_map(call: ast.Call, positional: tuple[str, ...]) -> dict[str, ast.expr]:
    args: dict[str, ast.expr] = dict(zip(positional, call.args, strict=False))
    args.update({kw.arg: kw.value for kw in call.keywords if kw.arg})
    return args


def _catalog_ref_from_table_name(table_ref: str) -> CatalogRef:
    parts = table_ref.split(".")
    if len(parts) == 3:
        return CatalogRef(database=parts[1], table=parts[2])
    if len(parts) == 2:
        return CatalogRef(database=parts[0], table=parts[1])
    return CatalogRef(database="default", table=table_ref)


def _extract_ast_call(
    call: ast.Call,
    reader: _ScriptReader,
    snowflake_fallback: dict[str, str],
    result: ScriptLineageResult,
) -> None:
    sf_match = _spark_snowflake_call(call, reader) or _glue_snowflake_call(call, reader)
    if sf_match:
        direction, settings = sf_match
        if direction == "sources":
            result.has_source_calls = True
        else:
            result.has_target_calls = True
        ref = _build_ref(_apply(settings), snowflake_fallback)
        if ref:
            if direction == "sources":
                result.snowflake_sources.append(ref)
            else:
                result.snowflake_targets.append(ref)
        return

    if _extract_glue_context_call(call, reader, result):
        return
    _extract_spark_call(call, reader, result)


def _extract_glue_context_call(
    call: ast.Call,
    reader: _ScriptReader,
    result: ScriptLineageResult,
) -> bool:
    func = call.func
    if not isinstance(func, ast.Attribute):
        return False

    method = func.attr
    parent_attr = func.value.attr if isinstance(func.value, ast.Attribute) else None

    if _extract_catalog_or_jdbc_conf_call(call, method, parent_attr, reader, result):
        return True

    is_read_opts = (method == "from_options" and parent_attr == "create_dynamic_frame") or (
        method == "create_dynamic_frame_from_options"
    )
    is_write_opts = (method == "from_options" and parent_attr == "write_dynamic_frame") or (
        method == "write_dynamic_frame_from_options"
    )
    if not (is_read_opts or is_write_opts):
        return False

    if is_read_opts:
        result.has_source_calls = True
    else:
        result.has_target_calls = True

    positional = (
        ("connection_type", "connection_options")
        if is_read_opts
        else ("frame", "connection_type", "connection_options")
    )
    args = _call_args_map(call, positional)
    conn_type = reader.string(args.get("connection_type"))
    if not isinstance(conn_type, str) or not conn_type:
        return True
    conn_type_lower = conn_type.lower()
    if conn_type_lower == "snowflake":
        return True
    conn_opts = reader.dict_value(args.get("connection_options"))
    if conn_type_lower == "s3":
        target_list = result.s3_sources if is_read_opts else result.s3_targets
        for p in _extract_s3_from_dict_value(reader, conn_opts):
            if p not in target_list:
                target_list.append(p)
        return True

    if is_read_opts and conn_type_lower not in JDBC_CONNECTION_TYPES:
        return True

    _extract_glue_options_jdbc_ref(args, conn_opts, is_read_opts, reader, result)
    return True


def _extract_catalog_or_jdbc_conf_call(
    call: ast.Call,
    method: str,
    parent_attr: str | None,
    reader: _ScriptReader,
    result: ScriptLineageResult,
) -> bool:
    if (method == "from_catalog" and parent_attr == "create_dynamic_frame") or (
        method == "create_dynamic_frame_from_catalog"
    ):
        result.has_source_calls = True
        args = _call_args_map(call, ("database", "table_name"))
        db = reader.string(args.get("database") or args.get("db"))
        tbl = reader.string(args.get("table_name"))
        if isinstance(db, str) and db and isinstance(tbl, str) and tbl:
            result.catalog_sources.append(CatalogRef(database=db, table=tbl))
        return True

    if (method == "from_catalog" and parent_attr == "write_dynamic_frame") or method in (
        "write_dynamic_frame_from_catalog",
        "purge_table",
    ):
        result.has_target_calls = True
        positional = ("database", "table_name") if method == "purge_table" else ("frame", "database", "table_name")
        args = _call_args_map(call, positional)
        db = reader.string(args.get("database") or args.get("db"))
        tbl = reader.string(args.get("table_name"))
        if isinstance(db, str) and db and isinstance(tbl, str) and tbl:
            result.catalog_targets.append(CatalogRef(database=db, table=tbl))
        return True

    if (method == "from_jdbc_conf" and parent_attr == "write_dynamic_frame") or (
        method == "write_dynamic_frame_from_jdbc_conf"
    ):
        result.has_target_calls = True
        args = _call_args_map(call, ("frame", "catalog_connection", "connection_options"))
        conn_name = reader.string(args.get("catalog_connection"))
        conn_opts = reader.dict_value(args.get("connection_options"))
        tbl = reader._scalar_to_str(conn_opts.entries.get("dbtable"))
        db = reader._scalar_to_str(conn_opts.entries.get("database"))
        if isinstance(tbl, str) and tbl:
            result.jdbc_targets.append(
                JDBCRef(
                    connection_name=conn_name if isinstance(conn_name, str) else None,
                    database=db if isinstance(db, str) else None,
                    table=tbl,
                )
            )
        return True
    return False


def _extract_glue_options_jdbc_ref(
    args: dict[str, ast.expr],
    conn_opts: _DictValue,
    is_read_opts: bool,
    reader: _ScriptReader,
    result: ScriptLineageResult,
) -> None:
    tbl = reader._scalar_to_str(conn_opts.entries.get("dbtable"))
    if not isinstance(tbl, str) and is_read_opts:
        tbl = reader._scalar_to_str(conn_opts.entries.get("dynamodb.input.tableName"))
    if not isinstance(tbl, str) or not tbl:
        return
    db = reader._scalar_to_str(conn_opts.entries.get("database"))
    conn_name = reader.string(args.get("catalog_connection") or args.get("connection_name"))
    if not isinstance(conn_name, str):
        conn_name = reader._scalar_to_str(conn_opts.entries.get("connectionName"))
    ref = JDBCRef(
        connection_name=conn_name if isinstance(conn_name, str) else None,
        database=db if isinstance(db, str) else None,
        table=tbl,
    )
    if is_read_opts:
        result.jdbc_sources.append(ref)
    else:
        result.jdbc_targets.append(ref)


def _extract_s3_from_dict_value(reader: _ScriptReader, conn_opts: _DictValue) -> list[str]:
    found: list[str] = []
    for key in ("paths", "path"):
        raw = conn_opts.entries.get(key)
        if isinstance(raw, str) and _is_s3_uri(raw):
            found.append(raw)
        elif isinstance(raw, tuple):
            for item in raw:
                s = reader._scalar_to_str(item)
                if isinstance(s, str) and _is_s3_uri(s):
                    found.append(s)
    return found


def _extract_spark_call(
    call: ast.Call,
    reader: _ScriptReader,
    result: ScriptLineageResult,
) -> None:
    if not isinstance(call.func, ast.Attribute):
        return

    chain: list[ast.Call] = []
    node: ast.expr = call.func.value
    while isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        chain.append(node)
        node = node.func.value

    terminal = call.func.attr

    if not chain and terminal == "table" and not (isinstance(node, ast.Attribute) and node.attr == "read"):
        result.has_source_calls = True
        args = _call_args_map(call, ("tableName",))
        table_ref = reader.string(args.get("tableName"))
        if isinstance(table_ref, str) and table_ref:
            result.catalog_sources.append(_catalog_ref_from_table_name(table_ref))
        return

    if not isinstance(node, ast.Attribute) or node.attr not in ("read", "write"):
        return

    spark_format, options_map = _collect_spark_chain_options(call, chain, reader)
    if isinstance(spark_format, str) and spark_format.lower() in SNOWFLAKE_FORMATS:
        return

    if node.attr == "read":
        if terminal in ("table", "jdbc") or terminal in SPARK_FILE_METHODS:
            result.has_source_calls = True
        _extract_spark_read_terminal(call, terminal, spark_format, options_map, reader, result)
    else:
        if terminal in ("saveAsTable", "insertInto", "jdbc") or terminal in SPARK_WRITE_FILE_METHODS:
            result.has_target_calls = True
        _extract_spark_write_terminal(call, terminal, spark_format, options_map, reader, result)


def _collect_spark_chain_options(
    call: ast.Call,
    chain: list[ast.Call],
    reader: _ScriptReader,
) -> tuple[object, dict[str, object]]:
    spark_format: object = None
    settings: list[tuple] = []
    for step in reversed(chain):
        step_method = step.func.attr  # type: ignore[union-attr]
        if step_method == "format" and step.args:
            spark_format = reader.string(step.args[0])
        elif step_method == "option":
            settings.append(_option_setting(step, reader))
        elif step_method == "options":
            settings.extend(reader.keyword_settings(step.keywords))
    for keyword in call.keywords:
        if keyword.arg == "format":
            spark_format = reader.string(keyword.value)
    settings.extend(
        reader.keyword_settings([keyword for keyword in call.keywords if keyword.arg not in SPARK_TERMINAL_PARAMETERS])
    )
    options_map: dict[str, object] = {}
    for k, v in settings:
        if k is OPAQUE:
            options_map.clear()
        elif isinstance(k, str):
            options_map[k] = v
    return spark_format, options_map


def _extract_spark_read_terminal(
    call: ast.Call,
    terminal: str,
    spark_format: object,
    options_map: dict[str, object],
    reader: _ScriptReader,
    result: ScriptLineageResult,
) -> None:
    if terminal == "table":
        args = _call_args_map(call, ("tableName",))
        table_ref = reader.string(args.get("tableName"))
        if isinstance(table_ref, str) and table_ref:
            result.catalog_sources.append(_catalog_ref_from_table_name(table_ref))
    elif terminal == "jdbc":
        args = _call_args_map(call, ("url", "table"))
        url = reader.string(args.get("url"))
        tbl = reader.string(args.get("table"))
        if isinstance(tbl, str) and tbl:
            result.jdbc_sources.append(JDBCRef(jdbc_url=url if isinstance(url, str) else None, table=tbl))
    elif terminal in SPARK_FILE_METHODS:
        if terminal == "load" and isinstance(spark_format, str) and spark_format.lower() == "jdbc":
            tbl = options_map.get("dbtable")
            url = options_map.get("url")
            if isinstance(tbl, str) and tbl:
                result.jdbc_sources.append(JDBCRef(jdbc_url=url if isinstance(url, str) else None, table=tbl))
            return
        for p in _extract_spark_paths(call, reader, options_map):
            if p not in result.s3_sources:
                result.s3_sources.append(p)


def _extract_spark_write_terminal(
    call: ast.Call,
    terminal: str,
    spark_format: object,
    options_map: dict[str, object],
    reader: _ScriptReader,
    result: ScriptLineageResult,
) -> None:
    if terminal in ("saveAsTable", "insertInto"):
        args = _call_args_map(call, ("name",))
        table_ref = reader.string(args.get("name") or args.get("tableName"))
        if isinstance(table_ref, str) and table_ref:
            result.catalog_targets.append(_catalog_ref_from_table_name(table_ref))
    elif terminal == "jdbc":
        args = _call_args_map(call, ("url", "table"))
        url = reader.string(args.get("url"))
        tbl = reader.string(args.get("table"))
        if isinstance(tbl, str) and tbl:
            result.jdbc_targets.append(JDBCRef(jdbc_url=url if isinstance(url, str) else None, table=tbl))
    elif terminal in SPARK_WRITE_FILE_METHODS:
        if terminal == "save" and isinstance(spark_format, str) and spark_format.lower() == "jdbc":
            tbl = options_map.get("dbtable")
            url = options_map.get("url")
            if isinstance(tbl, str) and tbl:
                result.jdbc_targets.append(JDBCRef(jdbc_url=url if isinstance(url, str) else None, table=tbl))
            return
        for p in _extract_spark_paths(call, reader, options_map):
            if p not in result.s3_targets:
                result.s3_targets.append(p)


def _extract_spark_paths(call: ast.Call, reader: _ScriptReader, options_map: dict[str, object]) -> list[str]:
    candidates: list[str] = []
    for arg in call.args:
        candidates.extend(reader.string_list(arg))
    for kw in call.keywords:
        if kw.arg in ("path", "paths"):
            candidates.extend(reader.string_list(kw.value))
    opt_path = options_map.get("path")
    if isinstance(opt_path, str):
        candidates.append(opt_path)
    return [p for p in candidates if _is_s3_uri(p)]


# --- Template-Guarded Regex Fallbacks ---


def _parse_with_regex_fallback(source_code: str) -> ScriptLineageResult:
    result = ScriptLineageResult()
    _parse_glue_context_sources(source_code, result)
    _parse_glue_context_targets(source_code, result)
    _parse_spark_read(source_code, result)
    _parse_spark_write(source_code, result)
    return result


def _parse_glue_context_sources(source_code: str, result: ScriptLineageResult) -> None:
    for match in FROM_CATALOG_PATTERN.finditer(source_code):
        result.has_source_calls = True
        block = match.group(1)
        database = _extract_kwarg(block, "database")
        table = _extract_kwarg(block, "table_name")
        if database and table:
            result.catalog_sources.append(CatalogRef(database=database, table=table))

    for match in FROM_OPTIONS_PATTERN.finditer(source_code):
        result.has_source_calls = True
        block = match.group(1)
        conn_type = _extract_kwarg(block, "connection_type")
        if conn_type and conn_type.lower() == "s3":
            result.s3_sources.extend(p for p in _extract_s3_paths(block) if p not in result.s3_sources)
        elif _is_snowflake(conn_type):
            continue
        elif conn_type and conn_type.lower() in JDBC_CONNECTION_TYPES:
            table = _extract_dict_value(block, "dbtable") or _extract_dict_value(block, "dynamodb.input.tableName")
            connection_name = _extract_kwarg(block, "catalog_connection") or _extract_kwarg(block, "connection_name")
            if table:
                result.jdbc_sources.append(JDBCRef(connection_name=connection_name, table=table))


def _parse_glue_context_targets(source_code: str, result: ScriptLineageResult) -> None:
    for match in WRITE_JDBC_CONF_PATTERN.finditer(source_code):
        result.has_target_calls = True
        block = match.group(1)
        connection_name = _extract_kwarg(block, "catalog_connection")
        table = _extract_dict_value(block, "dbtable")
        database = _extract_dict_value(block, "database")
        if table:
            result.jdbc_targets.append(JDBCRef(connection_name=connection_name, database=database, table=table))

    for match in WRITE_OPTIONS_PATTERN.finditer(source_code):
        result.has_target_calls = True
        block = match.group(1)
        conn_type = _extract_kwarg(block, "connection_type")
        if conn_type and conn_type.lower() == "s3":
            result.s3_targets.extend(p for p in _extract_s3_paths(block) if p not in result.s3_targets)
        elif _is_snowflake(conn_type):
            continue
        elif conn_type:
            table = _extract_dict_value(block, "dbtable")
            connection_name = _extract_kwarg(block, "catalog_connection")
            if table:
                result.jdbc_targets.append(JDBCRef(connection_name=connection_name, table=table))

    for pattern in (WRITE_CATALOG_PATTERN, PURGE_TABLE_PATTERN):
        for match in pattern.finditer(source_code):
            result.has_target_calls = True
            block = match.group(1)
            database = _extract_kwarg(block, "database")
            table = _extract_kwarg(block, "table_name")
            if database and table:
                result.catalog_targets.append(CatalogRef(database=database, table=table))


def _parse_spark_read(source_code: str, result: ScriptLineageResult) -> None:
    for pattern in (SPARK_READ_FORMAT_PATTERN, SPARK_READ_FORMAT_LOAD_PATTERN):
        for match in pattern.finditer(source_code):
            result.has_source_calls = True
            path = match.group(1)
            if _is_s3_uri(path) and path not in result.s3_sources:
                result.s3_sources.append(path)

    for match in SPARK_READ_JDBC_PATTERN.finditer(source_code):
        result.has_source_calls = True
        jdbc_url = match.group(1).strip()
        table = match.group(2).strip()
        if _is_resolved_text(table):
            result.jdbc_sources.append(JDBCRef(jdbc_url=jdbc_url if _is_resolved_text(jdbc_url) else None, table=table))

    for match in SPARK_READ_TABLE_PATTERN.finditer(source_code):
        result.has_source_calls = True
        table_ref = match.group(1)
        if _is_resolved_text(table_ref):
            result.catalog_sources.append(_catalog_ref_from_table_name(table_ref))


def _parse_spark_write(source_code: str, result: ScriptLineageResult) -> None:
    for pattern in (SPARK_WRITE_FORMAT_PATTERN, SPARK_WRITE_FORMAT_SAVE_PATTERN):
        for match in pattern.finditer(source_code):
            result.has_target_calls = True
            path = match.group(1)
            if _is_s3_uri(path) and path not in result.s3_targets:
                result.s3_targets.append(path)

    for match in SPARK_WRITE_JDBC_PATTERN.finditer(source_code):
        result.has_target_calls = True
        jdbc_url = match.group(1).strip()
        table = match.group(2).strip()
        if _is_resolved_text(table):
            result.jdbc_targets.append(JDBCRef(jdbc_url=jdbc_url if _is_resolved_text(jdbc_url) else None, table=table))

    for pattern in (SPARK_WRITE_SAVEASTABLE_PATTERN, SPARK_WRITE_INSERTINTO_PATTERN):
        for match in pattern.finditer(source_code):
            result.has_target_calls = True
            table_ref = match.group(1)
            if _is_resolved_text(table_ref):
                result.catalog_targets.append(_catalog_ref_from_table_name(table_ref))
