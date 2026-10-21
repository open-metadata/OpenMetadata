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
Snowflake reads and writes in AWS Glue job scripts, found with Python's own parser.

The script is parsed into an AST, so comments, quoting (triple quotes, escapes,
quotes of the other kind), line continuations and call order are handled by the
language rather than approximated by patterns over the source text:

    spark.read.format("snowflake").options(**sf_options).option("dbtable", "T").load()
    df.write.mode("append").format(SNOWFLAKE_SOURCE_NAME).option("dbtable", "T").save()
    glueContext.create_dynamic_frame.from_options(connection_type="snowflake", connection_options={...})
    glueContext.write_dynamic_frame.from_options(frame=df, connection_type="snowflake", connection_options={...})

Options are applied in call order and the last setting wins, as in Spark; keys
are case-insensitive. A value is resolved only when it is a literal or a name
bound to one by a plain assignment: anything else (a function parameter, an
f-string, args["X"], a dict built at runtime) is unknown, and a ref is only
produced when the table, and the schema when one is set, are known.
"""

import ast
import re
from dataclasses import dataclass

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

SNOWFLAKE_FORMATS = {"snowflake", "net.snowflake.spark.snowflake"}

DBTABLE, SF_DATABASE, SF_SCHEMA = "dbtable", "sfdatabase", "sfschema"
REF_KEYS = (DBTABLE, SF_DATABASE, SF_SCHEMA)

# GlueContext readers / writers and their positional parameters
GLUE_FROM_OPTIONS = {
    "create_dynamic_frame": ("sources", ("connection_type", "connection_options")),
    "write_dynamic_frame": ("targets", ("frame", "connection_type", "connection_options")),
}
GLUE_FLAT_FROM_OPTIONS = {
    "create_dynamic_frame_from_options": GLUE_FROM_OPTIONS["create_dynamic_frame"],
    "write_dynamic_frame_from_options": GLUE_FROM_OPTIONS["write_dynamic_frame"],
}
SPARK_DIRECTIONS = {("read", "load"): "sources", ("write", "save"): "targets"}

# dict methods that change a dict in place: its literal no longer describes it
MUTATING_METHODS = {"update", "setdefault", "pop", "popitem", "clear", "__setitem__", "__delitem__"}

# Snowflake identifiers: "ORDERS.V2" is one quoted name, FINANCE.CURATED.ORDERS are three
QUALIFIED_NAME_PART_PATTERN = re.compile(r'"[^"]*"|[^.]+')

MAX_DEPTH = 8


class _Unknown:
    """A value that is set but cannot be known without running the script."""

    def __repr__(self) -> str:
        return "UNKNOWN"


UNKNOWN = _Unknown()
ABSENT = object()
# an expansion whose keys cannot be listed (**get_options()): it may set any key
OPAQUE = object()


@dataclass
class SnowflakeRef:
    table: str
    database: str | None = None
    schema: str | None = None


class _Bindings:
    """
    Plain assignments per name. A name is resolved to the nearest earlier
    assignment only when every binding of it is a plain `name = value` statement
    in one module or function body; a name bound in a branch, a loop, as a
    parameter, or changed in place is unknown.
    """

    def __init__(self, tree: ast.Module):
        self._assignments: dict[str, list[tuple[int, ast.AST, ast.expr]]] = {}
        self._unresolvable: set[str] = set()
        parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
        for node in ast.walk(tree):
            self._index(node, parents)

    def _index(self, node: ast.AST, parents: dict) -> None:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                self._bind(target, node, parents)
        elif isinstance(node, ast.AnnAssign) and node.value is not None:
            self._bind(node.target, node, parents)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)):
            if not isinstance(parents.get(node), (ast.Assign, ast.AnnAssign)):
                self._unresolvable.add(node.id)  # for/with/except targets, walrus, del
        elif isinstance(node, ast.arg):
            self._unresolvable.add(node.arg)
        elif isinstance(node, (ast.Subscript, ast.Attribute)) and isinstance(node.ctx, (ast.Store, ast.Del)):
            self._mark_base(node.value)  # d["k"] = v, del d["k"]
        elif isinstance(node, ast.AugAssign):
            self._mark_base(node.target)  # d |= {...}, s += "..."
        elif _is_method_call(node, MUTATING_METHODS):
            self._mark_base(node.func.value)  # d.update(...)

    def _bind(self, target: ast.expr, statement: ast.stmt, parents: dict) -> None:
        if not isinstance(target, ast.Name):
            return
        body_owner = parents.get(statement)
        if isinstance(body_owner, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef)):
            self._assignments.setdefault(target.id, []).append((statement.lineno, body_owner, statement.value))
        else:
            self._unresolvable.add(target.id)

    def _mark_base(self, node: ast.expr) -> None:
        while isinstance(node, (ast.Subscript, ast.Attribute)):
            node = node.value
        if isinstance(node, ast.Name):
            self._unresolvable.add(node.id)

    def resolve(self, name: ast.Name) -> ast.expr | None:
        assignments = self._assignments.get(name.id, [])
        if name.id in self._unresolvable or len({id(owner) for _, owner, _ in assignments}) != 1:
            return None
        earlier = [(line, value) for line, _, value in assignments if line < name.lineno]
        return max(earlier, key=lambda item: item[0])[1] if earlier else None


class _ScriptReader:
    """Static values of a parsed script: strings and option settings."""

    def __init__(self, tree: ast.Module):
        self._bindings = _Bindings(tree)

    def string(self, node: ast.expr | None, depth: int = 0) -> str | _Unknown:
        if isinstance(node, ast.Constant) and isinstance(node.value, (str, int, float, bool)):
            return str(node.value)
        if isinstance(node, ast.Name) and depth < MAX_DEPTH:
            return self.string(self._bindings.resolve(node), depth + 1)
        return UNKNOWN

    def settings(self, node: ast.expr | None, depth: int = 0) -> list[tuple]:
        """Ordered (key, value) settings of a dict expression; [(OPAQUE, None)] when unlisted."""
        if isinstance(node, ast.Name) and depth < MAX_DEPTH:
            return self.settings(self._bindings.resolve(node), depth + 1)
        if isinstance(node, ast.Dict):
            return self._dict_literal_settings(node, depth)
        if self._is_dict_call(node):
            return self._dict_call_settings(node, depth)
        return [(OPAQUE, None)]

    def _dict_literal_settings(self, node: ast.Dict, depth: int) -> list[tuple]:
        settings = []
        for key, value in zip(node.keys, node.values, strict=True):
            if key is None:  # {**base, ...}
                settings.extend(self.settings(value, depth + 1))
            else:
                settings.append(self.setting(key, value))
        return settings

    def _dict_call_settings(self, node: ast.Call, depth: int) -> list[tuple]:
        settings = []
        for arg in node.args:  # dict(base, ...)
            settings.extend(self.settings(arg, depth + 1))
        settings.extend(self.keyword_settings(node.keywords, depth))
        return settings

    def keyword_settings(self, keywords: list[ast.keyword], depth: int = 0) -> list[tuple]:
        settings = []
        for keyword in keywords:
            if keyword.arg is None:  # **options
                settings.extend(self.settings(keyword.value, depth + 1))
            else:
                settings.append((keyword.arg.lower(), self.string(keyword.value)))
        return settings

    def setting(self, key: ast.expr, value: ast.expr) -> tuple:
        key_text = self.string(key)
        return (OPAQUE, None) if key_text is UNKNOWN else (key_text.lower(), self.string(value))

    @staticmethod
    def _is_dict_call(node: ast.expr | None) -> bool:
        return isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "dict"


def parse_snowflake_refs(source_code: str) -> tuple[list[SnowflakeRef], list[SnowflakeRef]]:
    """Snowflake (sources, targets) of a Glue script, in source order; none when it does not parse."""
    try:
        tree = ast.parse(source_code)
    except (SyntaxError, ValueError, RecursionError) as exc:
        logger.debug("Glue script is not parseable Python, skipping Snowflake lineage: %s", exc)
        return [], []

    reader = _ScriptReader(tree)
    fallback = _script_wide_values(tree)
    found = {"sources": [], "targets": []}
    calls = sorted(
        (node for node in ast.walk(tree) if isinstance(node, ast.Call)),
        key=lambda node: (node.lineno, node.col_offset),
    )
    for call in calls:
        match = _spark_snowflake_call(call, reader) or _glue_snowflake_call(call, reader)
        if match:
            direction, settings = match
            ref = _build_ref(_apply(settings), fallback)
            if ref:
                found[direction].append(ref)
                logger.debug("Found Snowflake %s: %s", direction, ref)
    return found["sources"], found["targets"]


def _spark_snowflake_call(call: ast.Call, reader: _ScriptReader) -> tuple[str, list[tuple]] | None:
    """`<x>.read ... .load()` / `<x>.write ... .save()` whose format is Snowflake."""
    if not isinstance(call.func, ast.Attribute):
        return None
    chain, node = [], call.func.value
    while isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        chain.append(node)
        node = node.func.value
    root = node.attr if isinstance(node, ast.Attribute) else None
    direction = SPARK_DIRECTIONS.get((root, call.func.attr))
    if not direction:
        return None

    spark_format, settings = None, []
    for step in reversed(chain):  # call order
        method = step.func.attr
        if method == "format" and step.args:
            spark_format = reader.string(step.args[0])
        elif method == "option" and len(step.args) == 2:
            settings.append(reader.setting(step.args[0], step.args[1]))
        elif method == "options":
            settings.extend(reader.keyword_settings(step.keywords))
    is_snowflake = isinstance(spark_format, str) and spark_format.lower() in SNOWFLAKE_FORMATS
    return (direction, settings) if is_snowflake else None


def _glue_snowflake_call(call: ast.Call, reader: _ScriptReader) -> tuple[str, list[tuple]] | None:
    """`glueContext.<create|write>_dynamic_frame.from_options(connection_type="snowflake", ...)`."""
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


def _apply(settings: list[tuple]) -> dict:
    """Settings in order, the last one winning; an opaque expansion may have set any key."""
    options = {}
    for key, value in settings:
        if key is OPAQUE:
            options.update(dict.fromkeys(REF_KEYS, UNKNOWN))
        else:
            options[key] = value
    return options


def _build_ref(options: dict, fallback: dict) -> SnowflakeRef | None:
    table = options.get(DBTABLE)
    if not isinstance(table, str) or not table:
        return None
    database, schema = options.get(SF_DATABASE, ABSENT), options.get(SF_SCHEMA, ABSENT)
    parts = [part.strip('"') for part in QUALIFIED_NAME_PART_PATTERN.findall(table)]
    if len(parts) == 3:
        database, schema, table = parts
    elif len(parts) == 2:
        schema, table = parts
    elif parts:
        table = parts[0]
    # an unknown schema must not fall back to a guess: linking another schema's table is worse than none
    if schema is UNKNOWN:
        return None
    return SnowflakeRef(
        table=table,
        database=_known(database, fallback.get(SF_DATABASE)),
        schema=_known(schema, fallback.get(SF_SCHEMA)),
    )


def _known(value, fallback: str | None) -> str | None:
    if value is ABSENT:
        return fallback
    return value if isinstance(value, str) else None


def _script_wide_values(tree: ast.Module) -> dict[str, str]:
    """
    sfDatabase / sfSchema literals anywhere in the script, used for a block that
    does not set the key at all. Only a single distinct value is trusted: with
    several, the block's own value cannot be told apart.
    """
    values: dict[str, set[str]] = {SF_DATABASE: set(), SF_SCHEMA: set()}
    for key, value in _literal_pairs(tree):
        if key.lower() in values and isinstance(value, str):
            values[key.lower()].add(value)
    return {key: found.pop() for key, found in values.items() if len(found) == 1}


def _literal_pairs(tree: ast.Module):
    for node in ast.walk(tree):
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values, strict=True):
                if _is_str(key) and _is_str(value):
                    yield key.value, value.value
        elif isinstance(node, ast.Call):
            yield from _call_literal_pairs(node)


def _call_literal_pairs(node: ast.Call):
    if _is_method_call(node, {"option"}) and len(node.args) == 2 and all(_is_str(arg) for arg in node.args):
        yield node.args[0].value, node.args[1].value
    for keyword in node.keywords:
        if keyword.arg and _is_str(keyword.value):
            yield keyword.arg, keyword.value.value


def _is_str(node: ast.expr | None) -> bool:
    return isinstance(node, ast.Constant) and isinstance(node.value, str)


def _is_method_call(node: ast.AST, methods: set[str]) -> bool:
    return isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in methods
