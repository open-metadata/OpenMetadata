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
Lineage parser for AWS Glue PySpark/GlueContext scripts.

Uses the neutral `script_evaluator` AST binding, expression, and execution-slice
engine together with `snowflake_parser` to emit typed `LineageGroup` contracts
as well as backward-compatible `ScriptLineageResult` summaries.
"""

import ast
import re
from dataclasses import dataclass, field
from typing import TypeAlias

from metadata.ingestion.source.pipeline.gluepipeline.script_evaluator import (
    FUNCTIONS,
    OPAQUE,
    SPARK_TERMINAL_PARAMETERS,
    DictValue,
    ExecutionSlice,
    LineageGroup,
    ParameterContext,
    ParsedScript,
    Resolved,
    ScriptBindings,
    ScriptReader,
    Side,
    build_execution_slices,
    merge_sides,
    parse_python_script,
    side_from_refs,
)
from metadata.ingestion.source.pipeline.gluepipeline.snowflake_parser import (
    SNOWFLAKE_FORMATS,
    SnowflakeRef,
    extract_snowflake_call,
    parse_snowflake_refs,
    script_wide_snowflake_values,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

__all__ = [
    "CatalogRef",
    "JDBCRef",
    "LineageGroup",
    "ParameterContext",
    "Resolved",
    "S3Ref",
    "ScriptLineageResult",
    "ScriptRef",
    "Side",
    "SnowflakeRef",
    "parse_glue_script",
    "parse_glue_script_slices",
    "parse_script_lineage_groups",
    "parse_snowflake_refs",
]

S3_PREFIXES = ("s3://", "s3a://", "s3n://")
JDBC_CONNECTION_TYPES = {"jdbc", "mysql", "postgresql", "oracle", "redshift", "sqlserver", "dynamodb"}
SPARK_FILE_METHODS = {"load", "json", "parquet", "csv", "orc", "avro", "text"}
SPARK_WRITE_FILE_METHODS = {"save", "json", "parquet", "csv", "orc", "avro", "text"}
TEMP_VIEW_METHODS = {
    "createOrReplaceTempView",
    "createTempView",
    "createGlobalTempView",
    "createOrReplaceGlobalTempView",
    "registerTempTable",
}
CONTAINER_ACCUMULATOR_METHODS = {"append", "extend", "insert", "update", "setdefault"}
MAX_CHANNEL_PROPAGATION_PASSES = 16

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
class S3Ref:
    path: str


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


ScriptRef: TypeAlias = S3Ref | CatalogRef | JDBCRef | SnowflakeRef
_ChannelKey: TypeAlias = tuple[object, ...]


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

    def item_count(self) -> int:
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

    def source_refs(self) -> tuple[ScriptRef, ...]:
        return (
            *(S3Ref(path=p) for p in self.s3_sources),
            *self.catalog_sources,
            *self.jdbc_sources,
            *self.snowflake_sources,
        )

    def target_refs(self) -> tuple[ScriptRef, ...]:
        return (
            *(S3Ref(path=p) for p in self.s3_targets),
            *self.catalog_targets,
            *self.jdbc_targets,
            *self.snowflake_targets,
        )

    def to_sides(self) -> tuple[Side[ScriptRef], Side[ScriptRef]]:
        sources = self.source_refs()
        targets = self.target_refs()
        return (
            side_from_refs(sources, declared=self.has_source_calls or bool(sources)),
            side_from_refs(targets, declared=self.has_target_calls or bool(targets)),
        )


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


def parse_script_lineage_groups(
    source_code: str | None,
    context: ParameterContext | None = None,
) -> list[LineageGroup[ScriptRef]]:
    """
    Parse a Glue script into typed `LineageGroup[ScriptRef]` units for `context`,
    correlating per-iteration loop slices as well as read/write dependencies split
    across sibling loops.
    """
    if not source_code:
        return []

    execution_id = context.execution_id if context is not None else "default"
    parsed = parse_python_script(source_code)
    if parsed is None:
        fallback_result = _parse_with_regex_fallback(source_code)
        sources, targets = fallback_result.to_sides()
        if sources == "absent" and targets == "absent":
            return []
        return [
            LineageGroup(
                execution_id=execution_id,
                dependency_id="regex_fallback",
                sources=sources,
                targets=targets,
            )
        ]

    try:
        slices = build_execution_slices(parsed.tree, context=context, bindings=parsed.bindings)
        return _analyze_slices_into_groups(parsed, slices, execution_id)
    except RecursionError as exc:
        logger.debug("Glue script exceeded recursion limit during lineage group analysis: %s", exc)
        return []


def parse_glue_script_slices(
    source_code: str | None,
    context: ParameterContext | None = None,
) -> list[ScriptLineageResult]:
    """
    Parse a Glue script into per-slice `ScriptLineageResult` summaries
    (one per constant-loop iteration when unrollable, or a single result).
    """
    if not source_code:
        return []

    parsed = parse_python_script(source_code)
    if parsed is None:
        fallback_result = _parse_with_regex_fallback(source_code)
        return [fallback_result] if fallback_result.has_lineage else []

    try:
        slices = build_execution_slices(parsed.tree, context=context, bindings=parsed.bindings)
    except RecursionError as exc:
        logger.debug("Glue script exceeded recursion limit during slice expansion: %s", exc)
        return []

    fallback = script_wide_snowflake_values(parsed.literal_pairs)
    active_loops = {slc.active_top_loop for slc in slices if slc.active_top_loop is not None}
    multi_top_loops = len(active_loops) > 1
    results: list[ScriptLineageResult] = []
    for slc in slices:
        slice_result = ScriptLineageResult()
        active_loop_resolved = False
        for call in parsed.calls:
            if not slc.call_included(call, parsed.bindings):
                continue
            before_count = slice_result.item_count()
            _extract_ast_call(call, slc.reader, fallback, slice_result)
            if (
                slc.active_top_loop is not None
                and slice_result.item_count() > before_count
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

    parsed = parse_python_script(source_code)
    if parsed is None:
        return _parse_with_regex_fallback(source_code)

    try:
        slices = build_execution_slices(parsed.tree, context=context, bindings=parsed.bindings)
    except RecursionError as exc:
        logger.debug("Glue script exceeded recursion limit during script lineage parsing: %s", exc)
        return result

    fallback = script_wide_snowflake_values(parsed.literal_pairs)
    seen_call_items: set[tuple[int, str, object]] = set()

    for call in parsed.calls:
        for slc in slices:
            if not slc.call_included(call, parsed.bindings):
                continue
            call_result = ScriptLineageResult()
            _extract_ast_call(call, slc.reader, fallback, call_result)
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


# --- Cross-Sibling-Loop Dependency Analysis ---


@dataclass
class _EvaluatedSlice:
    slc: ExecutionSlice
    sources: Side[ScriptRef]
    targets: Side[ScriptRef]
    loop_sources: Side[ScriptRef]
    loop_produced_channels: set[_ChannelKey]
    consumed_channels: set[_ChannelKey]
    has_function_scoped_source: bool
    has_function_scoped_target: bool
    paired_as_source: bool = False


def _can_flow_into(
    source_idx: int,
    source_item: _EvaluatedSlice,
    target_idx: int,
    target_item: _EvaluatedSlice,
) -> bool:
    """
    A sibling source slice can feed a target slice when it precedes the target slice,
    when either side lives inside a helper function (whose definition order is independent
    of call order), or when both share an enclosing outer loop.
    """
    if source_idx < target_idx:
        return True
    if source_item.has_function_scoped_source or target_item.has_function_scoped_target:
        return True
    source_loops = {loop for loop, _ in source_item.slc.loop_overrides}
    target_loops = {loop for loop, _ in target_item.slc.loop_overrides}
    return bool(source_loops & target_loops)


def _analyze_slices_into_groups(
    parsed: ParsedScript,
    slices: list[ExecutionSlice],
    execution_id: str,
) -> list[LineageGroup[ScriptRef]]:
    fallback = script_wide_snowflake_values(parsed.literal_pairs)
    all_statements = _ordered_statements(parsed.tree)
    evaluated: list[_EvaluatedSlice] = []

    for slc in slices:
        slice_result = ScriptLineageResult()
        loop_source_result = ScriptLineageResult()
        loop_source_calls: list[ast.Call] = []
        target_calls: list[ast.Call] = []
        for call in parsed.calls:
            if not slc.call_included(call, parsed.bindings):
                continue
            call_result = ScriptLineageResult()
            _extract_ast_call(call, slc.reader, fallback, call_result)
            in_active_loop = (
                slc.active_top_loop is not None and slc.active_top_loop in parsed.bindings.enclosing_for_loops(call)
            )
            if call_result.has_source_calls and (slc.active_top_loop is None or in_active_loop):
                loop_source_calls.append(call)
                _append_slice_result(loop_source_result, call_result)
            if call_result.has_target_calls:
                target_calls.append(call)
            _append_slice_result(slice_result, call_result)

        sources, targets = slice_result.to_sides()
        if sources == "absent" and targets == "absent":
            continue
        loop_sources, _ = loop_source_result.to_sides()

        active_stmts = [stmt for stmt in all_statements if _statement_included(stmt, slc, parsed.bindings)]
        loop_produced = _compute_produced_channels(loop_source_calls, active_stmts, slc.reader, parsed.bindings)
        consumed = _compute_consumed_channels(target_calls, active_stmts, slc.reader, parsed.bindings)
        evaluated.append(
            _EvaluatedSlice(
                slc=slc,
                sources=sources,
                targets=targets,
                loop_sources=loop_sources,
                loop_produced_channels=loop_produced,
                consumed_channels=consumed,
                has_function_scoped_source=any(
                    isinstance(parsed.bindings.scope_of(c), FUNCTIONS) for c in loop_source_calls
                ),
                has_function_scoped_target=any(
                    isinstance(parsed.bindings.scope_of(c), FUNCTIONS) for c in target_calls
                ),
            )
        )

    for idx, item in enumerate(evaluated):
        if item.targets == "absent" or not item.consumed_channels:
            continue
        matching_upstream = [
            cand
            for cand_idx, cand in enumerate(evaluated)
            if cand_idx != idx
            and cand.loop_sources != "absent"
            and cand.targets == "absent"
            and item.slc.compatible_with(cand.slc)
            and _can_flow_into(cand_idx, cand, idx, item)
            and bool(cand.loop_produced_channels & item.consumed_channels)
        ]
        if matching_upstream:
            for cand in matching_upstream:
                cand.paired_as_source = True
            upstream_sides: list[Side[ScriptRef]] = [item.sources, *(cand.loop_sources for cand in matching_upstream)]
            item.sources = merge_sides(upstream_sides)

    groups: list[LineageGroup[ScriptRef]] = []
    for item in evaluated:
        if item.paired_as_source:
            continue
        groups.append(
            LineageGroup(
                execution_id=execution_id,
                dependency_id=item.slc.slice_id,
                sources=item.sources,
                targets=item.targets,
            )
        )
    return groups


def _ordered_statements(tree: ast.Module) -> list[ast.stmt]:
    return sorted(
        (node for node in ast.walk(tree) if isinstance(node, ast.stmt)),
        key=lambda node: (getattr(node, "lineno", 0), getattr(node, "col_offset", 0)),
    )


def _statement_included(stmt: ast.stmt, slc: ExecutionSlice, bindings: ScriptBindings) -> bool:
    if not slc.excluded_loops:
        return True
    if isinstance(stmt, ast.For) and stmt in slc.excluded_loops:
        return False
    return not any(loop in slc.excluded_loops for loop in bindings.enclosing_for_loops(stmt))


def _store_target_channels(
    target: ast.AST,
    reader: ScriptReader,
    bindings: ScriptBindings,
) -> set[_ChannelKey]:
    out: set[_ChannelKey] = set()
    if isinstance(target, ast.Name) and not bindings.is_shadowed(target):
        owner = bindings.owner_of(bindings.scope_of(target), target.id)
        out.add(("var", id(owner), target.id))
    elif (
        isinstance(target, ast.Subscript)
        and isinstance(target.value, ast.Name)
        and not bindings.is_shadowed(target.value)
    ):
        owner = bindings.owner_of(bindings.scope_of(target.value), target.value.id)
        key = reader.string(target.slice)
        if isinstance(key, str):
            out.add(("item", id(owner), target.value.id, key))
            out.add(("any_item", id(owner), target.value.id))
        else:
            out.add(("var", id(owner), target.value.id))
            out.add(("any_item", id(owner), target.value.id))
    elif isinstance(target, (ast.Tuple, ast.List)):
        for elt in target.elts:
            out.update(_store_target_channels(elt, reader, bindings))
    return out


def _collect_keyed_lookup_channels(
    expr: ast.AST,
    reader: ScriptReader,
    bindings: ScriptBindings,
) -> tuple[set[_ChannelKey], set[int]]:
    channels: set[_ChannelKey] = set()
    keyed_bases: set[int] = set()
    for node in ast.walk(expr):
        if (
            isinstance(node, ast.Subscript)
            and isinstance(node.ctx, ast.Load)
            and isinstance(node.value, ast.Name)
            and not bindings.is_shadowed(node.value)
        ):
            owner = bindings.owner_of(bindings.scope_of(node.value), node.value.id)
            key = reader.string(node.slice)
            if isinstance(key, str):
                keyed_bases.add(id(node.value))
                channels.add(("item", id(owner), node.value.id, key))
                channels.add(("var", id(owner), node.value.id))
            else:
                channels.add(("var", id(owner), node.value.id))
                channels.add(("any_item", id(owner), node.value.id))
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "get"
            and not node.keywords
            and 1 <= len(node.args) <= 2
            and isinstance(node.func.value, ast.Name)
            and not bindings.is_shadowed(node.func.value)
        ):
            owner = bindings.owner_of(bindings.scope_of(node.func.value), node.func.value.id)
            key = reader.string(node.args[0])
            if isinstance(key, str):
                keyed_bases.add(id(node.func.value))
                channels.add(("item", id(owner), node.func.value.id, key))
                channels.add(("var", id(owner), node.func.value.id))
    return channels, keyed_bases


def _read_call_channels(node: ast.Call, reader: ScriptReader, bindings: ScriptBindings) -> set[_ChannelKey]:
    if isinstance(node.func, ast.Attribute) and node.func.attr == "sql" and node.args:
        sql_channels: set[_ChannelKey] = {("sql_view", "*")}
        sql_text = reader.string(node.args[0])
        if isinstance(sql_text, str):
            for token in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", sql_text):
                sql_channels.add(("sql_view", token))
        else:
            sql_channels.add(("sql_view_any",))
        return sql_channels
    fn_def = bindings.resolve_function_def(node.func)
    return {("func_return", id(fn_def))} if fn_def is not None else set()


def _read_expr_channels(
    expr: ast.AST | None,
    reader: ScriptReader,
    bindings: ScriptBindings,
) -> set[_ChannelKey]:
    if expr is None:
        return set()
    channels, keyed_subscript_bases = _collect_keyed_lookup_channels(expr, reader, bindings)

    for node in ast.walk(expr):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load) and id(node) not in keyed_subscript_bases:
            if bindings.is_shadowed(node):
                continue
            parent = bindings.parent_of(node)
            if isinstance(parent, ast.Call) and parent.func is node:
                continue
            owner = bindings.owner_of(bindings.scope_of(node), node.id)
            channels.add(("var", id(owner), node.id))
            channels.add(("any_item", id(owner), node.id))
        elif isinstance(node, ast.Call):
            channels.update(_read_call_channels(node, reader, bindings))

    if not channels and isinstance(expr, ast.Call):
        channels.add(("opaque_handoff", id(bindings.scope_of(expr))))
    return channels


def _direct_source_call_channels(
    call: ast.Call,
    reader: ScriptReader,
    bindings: ScriptBindings,
) -> set[_ChannelKey]:
    parent = bindings.parent_of(call)
    if isinstance(parent, ast.Expr) and parent.value is call:
        return set()

    channels: set[_ChannelKey] = set()
    cur: ast.AST = call
    anc = parent
    while anc is not None and not isinstance(anc, (*FUNCTIONS, ast.Module)):
        if isinstance(anc, ast.Assign) and cur is anc.value:
            for target in anc.targets:
                channels.update(_store_target_channels(target, reader, bindings))
        elif isinstance(anc, ast.AnnAssign) and cur is anc.value:
            channels.update(_store_target_channels(anc.target, reader, bindings))
        elif isinstance(anc, ast.NamedExpr) and cur is anc.value:
            channels.update(_store_target_channels(anc.target, reader, bindings))
        elif isinstance(anc, ast.Return):
            scope = bindings.scope_of(anc)
            if isinstance(scope, FUNCTIONS):
                channels.add(("func_return", id(scope)))
        elif isinstance(anc, ast.Call) and isinstance(anc.func, ast.Attribute):
            attr = anc.func.attr
            if attr in TEMP_VIEW_METHODS and (anc.func is cur or anc.func.value is cur):
                view_name = reader.string(anc.args[0]) if anc.args else None
                channels.add(("sql_view", view_name if isinstance(view_name, str) and view_name else "*"))
                channels.add(("sql_view_any",))
            elif (
                attr in CONTAINER_ACCUMULATOR_METHODS
                and cur in anc.args
                and isinstance(anc.func.value, ast.Name)
                and not bindings.is_shadowed(anc.func.value)
            ):
                owner = bindings.owner_of(bindings.scope_of(anc.func.value), anc.func.value.id)
                channels.add(("var", id(owner), anc.func.value.id))
                channels.add(("any_item", id(owner), anc.func.value.id))
        if isinstance(anc, ast.stmt):
            break
        cur, anc = anc, bindings.parent_of(anc)

    if not channels:
        channels.add(("opaque_handoff", id(bindings.scope_of(call))))
    return channels


def _expr_call_statement_edges(
    call: ast.Call,
    reader: ScriptReader,
    bindings: ScriptBindings,
) -> list[tuple[set[_ChannelKey], set[_ChannelKey]]]:
    edges: list[tuple[set[_ChannelKey], set[_ChannelKey]]] = []
    if isinstance(call.func, ast.Attribute):
        attr = call.func.attr
        if attr in TEMP_VIEW_METHODS:
            rhs = _read_expr_channels(call.func.value, reader, bindings)
            if rhs:
                view_name = reader.string(call.args[0]) if call.args else None
                lhs: set[_ChannelKey] = {
                    ("sql_view", view_name if isinstance(view_name, str) and view_name else "*"),
                    ("sql_view_any",),
                }
                edges.append((rhs, lhs))
        elif (
            attr in CONTAINER_ACCUMULATOR_METHODS
            and isinstance(call.func.value, ast.Name)
            and not bindings.is_shadowed(call.func.value)
        ):
            owner = bindings.owner_of(bindings.scope_of(call.func.value), call.func.value.id)
            rhs = set()
            for arg in call.args:
                rhs.update(_read_expr_channels(arg, reader, bindings))
            if rhs:
                edges.append(
                    (rhs, {("var", id(owner), call.func.value.id), ("any_item", id(owner), call.func.value.id)})
                )
    fn_def = bindings.resolve_function_def(call.func)
    if fn_def is not None:
        for arg_expr, param in zip(call.args, fn_def.args.args, strict=False):
            rhs = _read_expr_channels(arg_expr, reader, bindings)
            if rhs:
                edges.append((rhs, {("var", id(fn_def), param.arg)}))
        for kw in call.keywords:
            if kw.arg:
                rhs = _read_expr_channels(kw.value, reader, bindings)
                if rhs:
                    edges.append((rhs, {("var", id(fn_def), kw.arg)}))
    return edges


def _statement_edges(
    active_stmts: list[ast.stmt],
    reader: ScriptReader,
    bindings: ScriptBindings,
) -> list[tuple[set[_ChannelKey], set[_ChannelKey]]]:
    """Pairs `(rhs_channels, lhs_channels)` describing intra-script dataflow edges."""
    edges: list[tuple[set[_ChannelKey], set[_ChannelKey]]] = []
    for stmt in active_stmts:
        if isinstance(stmt, ast.Assign):
            rhs = _read_expr_channels(stmt.value, reader, bindings)
            lhs: set[_ChannelKey] = set()
            for target in stmt.targets:
                lhs.update(_store_target_channels(target, reader, bindings))
            if rhs and lhs:
                edges.append((rhs, lhs))
        elif isinstance(stmt, (ast.AnnAssign, ast.AugAssign)) and stmt.value is not None:
            rhs = _read_expr_channels(stmt.value, reader, bindings)
            lhs = _store_target_channels(stmt.target, reader, bindings)
            if rhs and lhs:
                edges.append((rhs, lhs))
        elif isinstance(stmt, ast.Return) and stmt.value is not None:
            scope = bindings.scope_of(stmt)
            if isinstance(scope, FUNCTIONS):
                rhs = _read_expr_channels(stmt.value, reader, bindings)
                if rhs:
                    edges.append((rhs, {("func_return", id(scope))}))
        elif isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
            edges.extend(_expr_call_statement_edges(stmt.value, reader, bindings))
    return edges


def _compute_produced_channels(
    source_calls: list[ast.Call],
    active_stmts: list[ast.stmt],
    reader: ScriptReader,
    bindings: ScriptBindings,
) -> set[_ChannelKey]:
    if not source_calls:
        return set()
    produced: set[_ChannelKey] = set()
    for call in source_calls:
        produced.update(_direct_source_call_channels(call, reader, bindings))
    if not produced:
        return produced
    edges = _statement_edges(active_stmts, reader, bindings)
    for _ in range(MAX_CHANNEL_PROPAGATION_PASSES):
        added = False
        for rhs, lhs in edges:
            if (produced & rhs) and not lhs.issubset(produced):
                produced.update(lhs)
                added = True
        if not added:
            break
    return produced


def _target_frame_expr(call: ast.Call) -> ast.expr | None:
    func = call.func
    if not isinstance(func, ast.Attribute):
        return None
    method = func.attr
    parent_attr = func.value.attr if isinstance(func.value, ast.Attribute) else None

    if method == "purge_table":
        return None
    if (parent_attr == "write_dynamic_frame" and method in ("from_options", "from_catalog", "from_jdbc_conf")) or (
        method
        in (
            "write_dynamic_frame_from_options",
            "write_dynamic_frame_from_catalog",
            "write_dynamic_frame_from_jdbc_conf",
        )
    ):
        args = _call_args_map(call, ("frame",))
        return args.get("frame")

    node: ast.expr = func.value
    while isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        node = node.func.value
    if isinstance(node, ast.Attribute) and node.attr == "write":
        return node.value
    return None


def _compute_consumed_channels(
    target_calls: list[ast.Call],
    active_stmts: list[ast.stmt],
    reader: ScriptReader,
    bindings: ScriptBindings,
) -> set[_ChannelKey]:
    if not target_calls:
        return set()
    consumed: set[_ChannelKey] = set()
    for call in target_calls:
        frame_expr = _target_frame_expr(call)
        consumed.update(_read_expr_channels(frame_expr, reader, bindings))
    if not consumed:
        return consumed
    edges = _statement_edges(active_stmts, reader, bindings)
    for _ in range(MAX_CHANNEL_PROPAGATION_PASSES):
        added = False
        for rhs, lhs in edges:
            if (consumed & lhs) and not rhs.issubset(consumed):
                consumed.update(rhs)
                added = True
        if not added:
            break
    return consumed


def _append_slice_result(target: ScriptLineageResult, delta: ScriptLineageResult) -> None:
    target.has_source_calls = target.has_source_calls or delta.has_source_calls
    target.has_target_calls = target.has_target_calls or delta.has_target_calls
    for path in delta.s3_sources:
        if path not in target.s3_sources:
            target.s3_sources.append(path)
    for path in delta.s3_targets:
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
        dest_list = getattr(target, field_name)
        for item in getattr(delta, field_name):
            if item not in dest_list:
                dest_list.append(item)


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
    reader: ScriptReader,
    snowflake_fallback: dict[str, str],
    result: ScriptLineageResult,
) -> None:
    sf_extracted = extract_snowflake_call(call, reader, snowflake_fallback)
    if sf_extracted is not None:
        direction, ref = sf_extracted
        if direction == "sources":
            result.has_source_calls = True
        else:
            result.has_target_calls = True
        if ref is not None:
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
    reader: ScriptReader,
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
    reader: ScriptReader,
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
        tbl = reader.scalar_to_str(conn_opts.entries.get("dbtable"))
        db = reader.scalar_to_str(conn_opts.entries.get("database"))
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
    conn_opts: DictValue,
    is_read_opts: bool,
    reader: ScriptReader,
    result: ScriptLineageResult,
) -> None:
    tbl = reader.scalar_to_str(conn_opts.entries.get("dbtable"))
    if not isinstance(tbl, str) and is_read_opts:
        tbl = reader.scalar_to_str(conn_opts.entries.get("dynamodb.input.tableName"))
    if not isinstance(tbl, str) or not tbl:
        return
    db = reader.scalar_to_str(conn_opts.entries.get("database"))
    conn_name = reader.string(args.get("catalog_connection") or args.get("connection_name"))
    if not isinstance(conn_name, str):
        conn_name = reader.scalar_to_str(conn_opts.entries.get("connectionName"))
    ref = JDBCRef(
        connection_name=conn_name if isinstance(conn_name, str) else None,
        database=db if isinstance(db, str) else None,
        table=tbl,
    )
    if is_read_opts:
        result.jdbc_sources.append(ref)
    else:
        result.jdbc_targets.append(ref)


def _extract_s3_from_dict_value(reader: ScriptReader, conn_opts: DictValue) -> list[str]:
    found: list[str] = []
    for key in ("paths", "path"):
        raw = conn_opts.entries.get(key)
        if isinstance(raw, str) and _is_s3_uri(raw):
            found.append(raw)
        elif hasattr(raw, "items") and isinstance(getattr(raw, "items", None), tuple):
            for item in raw.items:  # type: ignore[union-attr]
                s = reader.scalar_to_str(item)
                if isinstance(s, str) and _is_s3_uri(s):
                    found.append(s)
    return found


def _extract_spark_call(
    call: ast.Call,
    reader: ScriptReader,
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
    reader: ScriptReader,
) -> tuple[object, dict[str, object]]:
    spark_format: object = None
    settings: list[tuple[object, object]] = []
    for step in reversed(chain):
        step_method = step.func.attr  # type: ignore[union-attr]
        if step_method == "format" and step.args:
            spark_format = reader.string(step.args[0])
        elif step_method == "option":
            settings.append(reader.option_setting(step))
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
    reader: ScriptReader,
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
    reader: ScriptReader,
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


def _extract_spark_paths(call: ast.Call, reader: ScriptReader, options_map: dict[str, object]) -> list[str]:
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
