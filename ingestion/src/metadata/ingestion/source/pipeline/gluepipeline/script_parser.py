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
engine together with `snowflake_parser` and flow-sensitive frame provenance
tracking to emit typed `LineageGroup` contracts as well as backward-compatible
`ScriptLineageResult` summaries.
"""

import ast
import itertools
import operator
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal, TypeAlias

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError
from sqlglot.optimizer.scope import Scope, traverse_scope

from metadata.ingestion.source.pipeline.gluepipeline.script_evaluator import (
    COMPREHENSIONS,
    FUNCTIONS,
    MAX_EXPR_DEPTH,
    MAX_LOOP_UNROLLS,
    MAX_STRING_LENGTH,
    OPAQUE,
    SPARK_TERMINAL_PARAMETERS,
    UNKNOWN,
    DictKey,
    DictValue,
    LineageGroup,
    ParameterContext,
    ParsedScript,
    Resolved,
    ScalarValue,
    ScriptReader,
    Side,
    UnknownValue,
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
SPARK_BINARY_FRAME_METHODS = {
    "join",
    "crossJoin",
    "union",
    "unionAll",
    "unionByName",
    "intersect",
    "intersectAll",
    "subtract",
    "exceptAll",
}
IN_MEMORY_FRAME_CONSTRUCTORS = {
    "createDataFrame",
    "createEmptyDataFrame",
    "create_dynamic_frame_from_rdd",
    "from_rdd",
    "parallelize",
}
_ORDERING_OPS: dict[type[ast.cmpop], Callable[[Any, Any], Any]] = {
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}
# Builtins that never mutate their arguments; callables passed to them are still treated as run.
_NON_MUTATING_BUILTINS = frozenset(
    {"print", "len", "dict", "list", "tuple", "reduce", "str", "repr", "sorted", "set", "isinstance"}
)
# ADR:2026-11-13-glue-parameterized-lineage-evaluates-per-run-context
MAX_TOTAL_LOOP_STEPS = 256
MAX_CALL_DEPTH = 8
MAX_CONTAINER_ITEMS = 128

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
        return _analyze_script_provenance(parsed, context=context, execution_id=execution_id)
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


# --- Flow-Sensitive Frame Provenance Analysis ---


@dataclass(frozen=True)
class _FrameVal:
    side: Side[ScriptRef]


@dataclass(frozen=True)
class _ScalarVal:
    value: DictKey


class _OpaqueVal:
    pass


class _UnboundVal:
    pass


@dataclass(frozen=True)
class _TupleVal:
    items: tuple["_ProvVal", ...]


# Branch copies of one runtime container share an identity, so a state overwrite can hand the joined contents
# back to the container objects that callers evaluated before the join and still hold.
_new_container_identity = itertools.count().__next__


@dataclass
class _ListVal:
    items: list["_ProvVal"]
    opaque: bool = False
    contains_frames: bool = False
    identity: int = field(default_factory=_new_container_identity, compare=False, repr=False)


@dataclass
class _FrameDict:
    entries: dict[DictKey, "_ProvVal"]
    has_unknown_entries: bool = False
    contains_frames: bool = False
    identity: int = field(default_factory=_new_container_identity, compare=False, repr=False)


_ProvVal: TypeAlias = _FrameVal | _ScalarVal | _OpaqueVal | _UnboundVal | _TupleVal | _ListVal | _FrameDict
_Container: TypeAlias = _ListVal | _FrameDict
_FlowStatus: TypeAlias = Literal["normal", "break", "continue", "return"]

_OPAQUE_VAL = _OpaqueVal()
_UNBOUND_VAL = _UnboundVal()
_NONE_VAL = _ScalarVal(None)
_ESCAPED_ID = id(_UNBOUND_VAL)


def _truthiness(val: _ProvVal) -> bool | None:
    if isinstance(val, _ScalarVal):
        return bool(val.value)
    if isinstance(val, _FrameDict) and not val.has_unknown_entries:
        return bool(val.entries)
    if isinstance(val, _ListVal) and not val.opaque:
        return bool(val.items)
    if isinstance(val, _TupleVal):
        return bool(val.items)
    return None


def _carries_frame(val: _ProvVal) -> bool:
    if isinstance(val, _FrameVal):
        return True
    if isinstance(val, _ListVal):
        return val.contains_frames or any(_carries_frame(item) for item in val.items)
    if isinstance(val, _FrameDict):
        return val.contains_frames or any(_carries_frame(item) for item in val.entries.values())
    if isinstance(val, _TupleVal):
        return any(_carries_frame(item) for item in val.items)
    return False


def _dict_key_of_val(val: _ProvVal) -> DictKey | UnknownValue:
    if isinstance(val, _ScalarVal):
        return val.value
    if isinstance(val, _TupleVal):
        parts: list[DictKey] = []
        for item in val.items:
            if not isinstance(item, _ScalarVal):
                return UNKNOWN
            parts.append(item.value)
        return tuple(parts)
    return UNKNOWN


def _compare_known_keys(left: DictKey | UnknownValue, op: ast.cmpop, right: DictKey | UnknownValue) -> bool | None:
    if isinstance(left, UnknownValue) or isinstance(right, UnknownValue):
        return None
    if isinstance(op, (ast.Eq, ast.NotEq)):
        equal = left == right
        return equal if isinstance(op, ast.Eq) else not equal
    ordering = _ORDERING_OPS.get(type(op))
    if ordering is None:
        return None
    try:
        return bool(ordering(left, right))
    except TypeError:
        return None


def _invalidate_reachable(val: _ProvVal | None, seen: set[int] | None = None) -> None:
    """A callee the analyzer cannot inspect may mutate every container it can reach, not only the outer one."""
    seen = set() if seen is None else seen
    if val is None or id(val) in seen:
        return
    seen.add(id(val))
    if isinstance(val, _FrameDict):
        for item in val.entries.values():
            _invalidate_reachable(item, seen)
        val.entries.clear()
        val.has_unknown_entries = True
    elif isinstance(val, _ListVal):
        for item in val.items:
            _invalidate_reachable(item, seen)
        val.items.clear()
        val.opaque = True
    elif isinstance(val, _TupleVal):
        for item in val.items:
            _invalidate_reachable(item, seen)


def _is_access_path(expr: ast.expr) -> bool:
    while isinstance(expr, ast.Subscript) and isinstance(expr.slice, (ast.Constant, ast.Name)):
        expr = expr.value
    return isinstance(expr, ast.Name)


def _as_required_frame_side(val: _ProvVal) -> Side[ScriptRef]:
    if isinstance(val, _FrameVal):
        return val.side
    if isinstance(val, _UnboundVal):
        return "absent"
    return "unresolved"


def _prov_equal(left: _ProvVal, right: _ProvVal) -> bool:
    if type(left) is not type(right):
        return False
    if isinstance(left, _FrameVal) and isinstance(right, _FrameVal):
        return left.side == right.side
    if isinstance(left, _ScalarVal) and isinstance(right, _ScalarVal):
        return type(left.value) is type(right.value) and left.value == right.value
    if isinstance(left, (_OpaqueVal, _UnboundVal)):
        return True
    if isinstance(left, _TupleVal) and isinstance(right, _TupleVal):
        return len(left.items) == len(right.items) and all(
            _prov_equal(a, b) for a, b in zip(left.items, right.items, strict=True)
        )
    if isinstance(left, _ListVal) and isinstance(right, _ListVal):
        if left.opaque != right.opaque or len(left.items) != len(right.items):
            return False
        return not left.opaque and all(_prov_equal(a, b) for a, b in zip(left.items, right.items, strict=True))
    if isinstance(left, _FrameDict) and isinstance(right, _FrameDict):
        if left.has_unknown_entries or right.has_unknown_entries:
            return False
        if set(left.entries) != set(right.entries):
            return False
        return all(_prov_equal(left.entries[k], right.entries[k]) for k in left.entries)
    return False


def _clone_prov(val: _ProvVal, memo: dict[int, _ProvVal]) -> _ProvVal:
    if isinstance(val, _ListVal):
        obj_id = id(val)
        if obj_id not in memo:
            cloned = _ListVal(items=[], opaque=val.opaque, contains_frames=val.contains_frames, identity=val.identity)
            memo[obj_id] = cloned
            cloned.items = [_clone_prov(item, memo) for item in val.items]
        return memo[obj_id]
    if isinstance(val, _FrameDict):
        obj_id = id(val)
        if obj_id not in memo:
            cloned_dict = _FrameDict(
                entries={},
                has_unknown_entries=val.has_unknown_entries,
                contains_frames=val.contains_frames,
                identity=val.identity,
            )
            memo[obj_id] = cloned_dict
            cloned_dict.entries = {k: _clone_prov(v, memo) for k, v in val.entries.items()}
        return memo[obj_id]
    if isinstance(val, _TupleVal):
        return _TupleVal(tuple(_clone_prov(item, memo) for item in val.items))
    return val


def _joined_identity(left: _Container, right: _Container) -> int:
    # Copies of one container stay that container; a merge of two different ones is a new abstract object.
    return left.identity if left.identity == right.identity else _new_container_identity()


def _join_frame_dicts(
    left: _FrameDict,
    right: _FrameDict,
    pair_key: tuple[int, int],
    pair_memo: dict[tuple[int, int], _ProvVal] | None,
) -> _FrameDict:
    joined_dict = _FrameDict(
        entries={},
        has_unknown_entries=left.has_unknown_entries or right.has_unknown_entries,
        identity=_joined_identity(left, right),
    )
    if pair_memo is not None:
        pair_memo[pair_key] = joined_dict
    all_keys: list[DictKey] = [*left.entries.keys(), *(k for k in right.entries if k not in left.entries)]
    merged_entries: dict[DictKey, _ProvVal] = {}
    for k in all_keys:
        if k in left.entries and k in right.entries:
            merged_entries[k] = _join_prov(left.entries[k], right.entries[k], pair_memo)
            continue
        if pair_memo is not None:
            _record_escaped_containers(left.entries.get(k, _NONE_VAL), right.entries.get(k, _NONE_VAL), pair_memo)
        merged_entries[k] = _FrameVal("unresolved")
    joined_dict.entries = merged_entries
    joined_dict.contains_frames = (
        left.contains_frames or right.contains_frames or any(_carries_frame(v) for v in merged_entries.values())
    )
    return joined_dict


def _join_list_vals(
    left: _ListVal,
    right: _ListVal,
    pair_key: tuple[int, int],
    pair_memo: dict[tuple[int, int], _ProvVal] | None,
) -> _ListVal:
    contains = left.contains_frames or right.contains_frames
    identity = _joined_identity(left, right)
    if not left.opaque and not right.opaque and len(left.items) == len(right.items):
        joined_list = _ListVal(items=[], opaque=False, contains_frames=contains, identity=identity)
        if pair_memo is not None:
            pair_memo[pair_key] = joined_list
        joined_items = [_join_prov(a, b, pair_memo) for a, b in zip(left.items, right.items, strict=True)]
        joined_list.items = joined_items
        joined_list.contains_frames = contains or any(_carries_frame(v) for v in joined_items)
        return joined_list
    opaque_list = _ListVal(items=[], opaque=True, contains_frames=contains, identity=identity)
    if pair_memo is not None:
        pair_memo[pair_key] = opaque_list
        for item in left.items:
            _record_escaped_containers(item, _NONE_VAL, pair_memo)
        for item in right.items:
            _record_escaped_containers(_NONE_VAL, item, pair_memo)
    return opaque_list


def _join_prov(
    left: _ProvVal,
    right: _ProvVal,
    pair_memo: dict[tuple[int, int], _ProvVal] | None = None,
) -> _ProvVal:
    pair_key = (id(left), id(right))
    if (
        pair_memo is not None
        and pair_key in pair_memo
        and isinstance(left, (_ListVal, _FrameDict))
        and isinstance(right, (_ListVal, _FrameDict))
    ):
        return pair_memo[pair_key]
    # Containers always join structurally so every nested pair lands in pair_memo and shared aliases stay shared.
    if not isinstance(left, (_ListVal, _FrameDict, _TupleVal)) and _prov_equal(left, right):
        return left
    if isinstance(left, _FrameDict) and isinstance(right, _FrameDict):
        return _join_frame_dicts(left, right, pair_key, pair_memo)
    if isinstance(left, _ListVal) and isinstance(right, _ListVal):
        return _join_list_vals(left, right, pair_key, pair_memo)
    if isinstance(left, _TupleVal) and isinstance(right, _TupleVal) and len(left.items) == len(right.items):
        return _TupleVal(tuple(_join_prov(a, b, pair_memo) for a, b in zip(left.items, right.items, strict=True)))
    if pair_memo is not None:
        _record_escaped_containers(left, right, pair_memo)
    if _carries_frame(left) or _carries_frame(right):
        return _FrameVal("unresolved")
    return _OPAQUE_VAL


def _record_escaped_containers(left: _ProvVal, right: _ProvVal, pair_memo: dict[tuple[int, int], _ProvVal]) -> None:
    # A container joined against a non-container leaves no joined copy to carry its alias; an extra pair entry
    # makes _invalidate_ambiguous_aliases treat it as aliased differently per branch.
    for side, val in ((0, left), (1, right)):
        stack, seen = [val], set()
        while stack:
            cur = stack.pop()
            if id(cur) in seen:
                continue
            seen.add(id(cur))
            if isinstance(cur, (_FrameDict, _ListVal)):
                pair_memo[(id(cur), _ESCAPED_ID) if side == 0 else (_ESCAPED_ID, id(cur))] = _OPAQUE_VAL
            if isinstance(cur, _FrameDict):
                stack.extend(cur.entries.values())
            elif isinstance(cur, (_ListVal, _TupleVal)):
                stack.extend(cur.items)


def _invalidate_ambiguous_aliases(pair_memo: dict[tuple[int, int], _ProvVal]) -> None:
    """A container paired with different partners on the two sides is aliased differently per branch; one
    joined copy cannot keep both alias sets, so every joined copy it took part in becomes unknown."""
    left_uses: dict[int, int] = {}
    right_uses: dict[int, int] = {}
    for left_id, right_id in pair_memo:
        left_uses[left_id] = left_uses.get(left_id, 0) + 1
        right_uses[right_id] = right_uses.get(right_id, 0) + 1
    for (left_id, right_id), joined in pair_memo.items():
        if left_uses[left_id] > 1 or right_uses[right_id] > 1:
            _invalidate_reachable(joined)


def _join_alternatives(vals: Sequence[_ProvVal]) -> _ProvVal:
    """Join the values an expression may yield (`a if c else b`, `a or b`) when it is unknown which one."""
    if all(val is vals[0] for val in vals):
        return vals[0]
    # The result aliases whichever container it turns out to be, and no joined copy can stand in for all of them.
    for val in vals:
        _invalidate_reachable(val)
    joined = vals[0]
    for val in vals[1:]:
        joined = _join_prov(joined, val)
    return joined


def _join_view_maps(
    left: dict[str, Side[ScriptRef]],
    left_opaque: bool,
    right: dict[str, Side[ScriptRef]],
    right_opaque: bool,
) -> tuple[dict[str, Side[ScriptRef]], bool]:
    merged: dict[str, Side[ScriptRef]] = {}
    for name in set(left) | set(right):
        if name in left and name in right and left[name] == right[name]:
            merged[name] = left[name]
        else:
            merged[name] = "unresolved"
    return merged, (left_opaque or right_opaque)


def _join_fn_defaults(
    left: dict[int, dict[str, tuple[_ProvVal, object]]],
    right: dict[int, dict[str, tuple[_ProvVal, object]]],
    pair_memo: dict[tuple[int, int], _ProvVal],
) -> dict[int, dict[str, tuple[_ProvVal, object]]]:
    merged: dict[int, dict[str, tuple[_ProvVal, object]]] = {}
    for fn_id in set(left) | set(right):
        if fn_id in left and fn_id in right:
            l_defs, r_defs = left[fn_id], right[fn_id]
            merged[fn_id] = {
                p_name: (
                    _join_prov(l_defs[p_name][0], r_defs[p_name][0], pair_memo),
                    l_defs[p_name][1]
                    if type(l_defs[p_name][1]) is type(r_defs[p_name][1]) and l_defs[p_name][1] == r_defs[p_name][1]
                    else UNKNOWN,
                )
                if p_name in l_defs and p_name in r_defs
                else (_FrameVal("unresolved"), UNKNOWN)
                for p_name in set(l_defs) | set(r_defs)
            }
        else:
            only_defs = left[fn_id] if fn_id in left else right[fn_id]
            merged[fn_id] = {p_name: (_FrameVal("unresolved"), UNKNOWN) for p_name in only_defs}
    return merged


@dataclass
class _ExecState:
    scope_envs: dict[int, dict[str, _ProvVal]]
    loop_overrides: dict[ast.For, ScalarValue]
    scope_overrides: dict[tuple[ast.AST, str], object]
    fn_defaults: dict[int, dict[str, tuple[_ProvVal, object]]] = field(default_factory=dict)
    temp_views: dict[str, Side[ScriptRef]] = field(default_factory=dict)
    temp_views_opaque: bool = False
    global_temp_views: dict[str, Side[ScriptRef]] = field(default_factory=dict)
    global_temp_views_opaque: bool = False

    def clone_with_val(self, val: _ProvVal) -> tuple["_ExecState", _ProvVal]:
        memo: dict[int, _ProvVal] = {}
        cloned_scopes = {
            scope_id: {name: _clone_prov(pval, memo) for name, pval in env.items()}
            for scope_id, env in self.scope_envs.items()
        }
        cloned_defaults = {
            fn_id: {p_name: (_clone_prov(pval, memo), rval) for p_name, (pval, rval) in dmap.items()}
            for fn_id, dmap in self.fn_defaults.items()
        }
        cloned_val = _clone_prov(val, memo)
        return (
            _ExecState(
                scope_envs=cloned_scopes,
                loop_overrides=dict(self.loop_overrides),
                scope_overrides=dict(self.scope_overrides),
                fn_defaults=cloned_defaults,
                temp_views=dict(self.temp_views),
                temp_views_opaque=self.temp_views_opaque,
                global_temp_views=dict(self.global_temp_views),
                global_temp_views_opaque=self.global_temp_views_opaque,
            ),
            cloned_val,
        )

    def clone(self) -> "_ExecState":
        return self.clone_with_val(_NONE_VAL)[0]


def _join_states(
    left: _ExecState,
    right: _ExecState,
    pair_memo: dict[tuple[int, int], _ProvVal] | None = None,
) -> _ExecState:
    shared_memo: dict[tuple[int, int], _ProvVal] = {} if pair_memo is None else pair_memo
    joined_scopes: dict[int, dict[str, _ProvVal]] = {}
    for scope_id in set(left.scope_envs) | set(right.scope_envs):
        l_env = left.scope_envs.get(scope_id, {})
        r_env = right.scope_envs.get(scope_id, {})
        merged_env: dict[str, _ProvVal] = {}
        for name in set(l_env) | set(r_env):
            merged_env[name] = _join_prov(
                l_env.get(name, _UNBOUND_VAL),
                r_env.get(name, _UNBOUND_VAL),
                shared_memo,
            )
        joined_scopes[scope_id] = merged_env

    joined_overrides: dict[tuple[ast.AST, str], object] = {}
    for key in set(left.scope_overrides) | set(right.scope_overrides):
        lv = left.scope_overrides.get(key, UNKNOWN)
        rv = right.scope_overrides.get(key, UNKNOWN)
        joined_overrides[key] = lv if type(lv) is type(rv) and lv == rv else UNKNOWN

    joined_defaults = _join_fn_defaults(left.fn_defaults, right.fn_defaults, shared_memo)
    _invalidate_ambiguous_aliases(shared_memo)
    temp_views, temp_opaque = _join_view_maps(
        left.temp_views, left.temp_views_opaque, right.temp_views, right.temp_views_opaque
    )
    global_views, global_opaque = _join_view_maps(
        left.global_temp_views,
        left.global_temp_views_opaque,
        right.global_temp_views,
        right.global_temp_views_opaque,
    )
    return _ExecState(
        scope_envs=joined_scopes,
        loop_overrides=dict(left.loop_overrides),
        scope_overrides=joined_overrides,
        fn_defaults=joined_defaults,
        temp_views=temp_views,
        temp_views_opaque=temp_opaque,
        global_temp_views=global_views,
        global_temp_views_opaque=global_opaque,
    )


def _reachable_containers(roots: Sequence[_ProvVal]) -> list[_Container]:
    found: list[_Container] = []
    seen: set[int] = set()
    stack = list(roots)
    while stack:
        cur = stack.pop()
        if id(cur) in seen:
            continue
        seen.add(id(cur))
        if isinstance(cur, _FrameDict):
            found.append(cur)
            stack.extend(cur.entries.values())
        elif isinstance(cur, _ListVal):
            found.append(cur)
            stack.extend(cur.items)
        elif isinstance(cur, _TupleVal):
            stack.extend(cur.items)
    return found


def _state_roots(state: _ExecState) -> list[_ProvVal]:
    roots = [val for env in state.scope_envs.values() for val in env.values()]
    roots.extend(pval for dmap in state.fn_defaults.values() for pval, _ in dmap.values())
    return roots


def _group_by_identity(containers: Sequence[_Container]) -> dict[int, list[_Container]]:
    grouped: dict[int, list[_Container]] = {}
    for container in containers:
        grouped.setdefault(container.identity, []).append(container)
    return grouped


def _forget_contents(container: _Container) -> None:
    if isinstance(container, _FrameDict):
        container.entries.clear()
        container.has_unknown_entries = True
    else:
        container.items.clear()
        container.opaque = True


def _move_contents(target: _Container, source: _Container, swap: Callable[[_ProvVal], _ProvVal]) -> None:
    if isinstance(source, _FrameDict) and isinstance(target, _FrameDict):
        entries = {key: swap(val) for key, val in source.entries.items()}
        target.entries.clear()
        target.entries.update(entries)
        target.has_unknown_entries = source.has_unknown_entries
    elif isinstance(source, _ListVal) and isinstance(target, _ListVal):
        target.items[:] = [swap(val) for val in source.items]
        target.opaque = source.opaque
    target.contains_frames = source.contains_frames


def _adopt_joined_containers(dest: _ExecState, src: _ExecState, carried: _ProvVal) -> _ProvVal:
    """Put src's container contents into the objects dest already has before dest takes over src's scopes.

    An expression may hold a container (a method receiver, an earlier argument, a loop's items) while a later
    operand joins the state; that value must keep aliasing the state, not a copy the join replaced. A held
    container whose identity no longer maps to exactly one joined copy cannot stay connected, so it is forgotten.
    `carried` is a value computed in src (a helper's return) and is relinked the same way."""
    old_containers = _reachable_containers(_state_roots(dest))
    new_containers = _reachable_containers(_state_roots(src))
    new_ids = {id(container) for container in new_containers}
    new_by_identity = _group_by_identity(new_containers)
    adopted: dict[int, _Container] = {}
    for identity, olds in _group_by_identity(old_containers).items():
        news = new_by_identity.get(identity, [])
        if len(olds) == 1 and len(news) == 1:
            if news[0] is not olds[0]:
                adopted[id(news[0])] = olds[0]
            continue
        for old in olds:
            if id(old) not in new_ids:
                _forget_contents(old)
    if not adopted:
        return carried

    def swap(val: _ProvVal) -> _ProvVal:
        if isinstance(val, (_ListVal, _FrameDict)):
            return adopted.get(id(val), val)
        if isinstance(val, _TupleVal):
            items = tuple(swap(item) for item in val.items)
            return val if all(a is b for a, b in zip(items, val.items, strict=True)) else _TupleVal(items)
        return val

    old_ids = {id(container) for container in old_containers}
    detached = [c for c in _reachable_containers([carried]) if id(c) not in new_ids and id(c) not in old_ids]
    for container in [*new_containers, *detached]:
        _move_contents(adopted.get(id(container), container), container, swap)
    for env in src.scope_envs.values():
        for name, val in env.items():
            env[name] = swap(val)
    for dmap in src.fn_defaults.values():
        for p_name, (pval, rval) in dmap.items():
            dmap[p_name] = (swap(pval), rval)
    return swap(carried)


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


def _is_spark_table_read_call(call: ast.Call) -> ast.expr | None:
    if not isinstance(call.func, ast.Attribute) or call.func.attr != "table":
        return None
    chain: list[ast.Call] = []
    node: ast.expr = call.func.value
    while isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        chain.append(node)
        node = node.func.value
    if not chain and not (isinstance(node, ast.Attribute) and node.attr == "write"):
        args = _call_args_map(call, ("tableName",))
        return args.get("tableName")
    if isinstance(node, ast.Attribute) and node.attr == "read":
        args = _call_args_map(call, ("tableName",))
        return args.get("tableName")
    return None


def _extract_sql_query_tables(statement: exp.Query) -> list[tuple[str, str, str]] | None:
    scopes = traverse_scope(statement)
    if not scopes:
        return []
    tables: list[tuple[str, str, str]] = []
    for scope in scopes:
        for tbl in scope.tables or ():
            source = scope.sources.get(tbl.alias_or_name)
            if not tbl.db and not tbl.catalog and isinstance(source, Scope):
                continue
            if not tbl.name:
                return None
            tables.append((tbl.catalog or "", tbl.db or "", tbl.name))
    return tables


def _resolve_sql_table_list(tables: Sequence[tuple[str, str, str]], state: _ExecState) -> Side[ScriptRef]:
    if not tables:
        return "absent"
    sides: list[Side[ScriptRef]] = []
    for catalog, db, name in tables:
        if catalog:
            return "unresolved"
        lowered = name.lower()
        if db:
            if db.lower() != "global_temp":
                return "unresolved"
            if lowered in state.global_temp_views:
                sides.append(state.global_temp_views[lowered])
            else:
                return "unresolved"
        elif lowered in state.temp_views:
            sides.append(state.temp_views[lowered])
        else:
            return "unresolved"
    return merge_sides(sides)


def _resolve_spark_sql(sql_text: str, state: _ExecState) -> _FrameVal:
    try:
        statements = sqlglot.parse(sql_text, read="spark")
    except SqlglotError:
        state.temp_views.clear()
        state.temp_views_opaque = True
        return _FrameVal("unresolved")
    if not statements or any(not isinstance(stmt, exp.Query) for stmt in statements):
        state.temp_views.clear()
        state.temp_views_opaque = True
        return _FrameVal("unresolved")

    collected_sides: list[Side[ScriptRef]] = []
    for stmt in statements:
        assert isinstance(stmt, exp.Query)
        tables = _extract_sql_query_tables(stmt)
        if tables is None:
            return _FrameVal("unresolved")
        collected_sides.append(_resolve_sql_table_list(tables, state))
    return _FrameVal(merge_sides(collected_sides))


class _ProvenanceAnalyzer:
    """Flow-sensitive AST interpreter tracking reaching frame, container, and temp-view provenance."""

    def __init__(
        self,
        parsed: ParsedScript,
        context: ParameterContext | None,
        execution_id: str,
    ):
        self._parsed = parsed
        self._bindings = parsed.bindings
        self._base_reader = ScriptReader(parsed.tree, context=context, bindings=parsed.bindings)
        self._snowflake_fallback = script_wide_snowflake_values(parsed.literal_pairs)
        self._execution_id = execution_id
        self._target_groups: list[LineageGroup[ScriptRef]] = []
        self._source_events: list[Side[ScriptRef]] = []
        self._call_stack: list[ast.AST] = [parsed.tree]
        self._total_loop_steps = 0
        self._expr_depth = 0
        self._suppress_io_depth = 0

    def analyze(self) -> list[LineageGroup[ScriptRef]]:
        state = _ExecState(scope_envs={id(self._parsed.tree): {}}, loop_overrides={}, scope_overrides={})
        self._exec_block(self._parsed.tree.body, state, self._parsed.tree)
        if self._target_groups:
            return self._target_groups
        return [
            LineageGroup(
                execution_id=self._execution_id,
                dependency_id=f"slice_{idx}",
                sources=src_side,
                targets="absent",
            )
            for idx, src_side in enumerate(self._source_events)
        ]

    def _reader_for(self, state: _ExecState) -> ScriptReader:
        if not state.loop_overrides and not state.scope_overrides:
            return self._base_reader
        return self._base_reader.with_overrides(
            loop_overrides=state.loop_overrides,
            scope_overrides=state.scope_overrides,
        )

    def _record_target_group(self, sources: Side[ScriptRef], targets: Side[ScriptRef]) -> None:
        if self._suppress_io_depth > 0:
            return
        idx = len(self._target_groups)
        self._target_groups.append(
            LineageGroup(
                execution_id=self._execution_id,
                dependency_id=f"slice_{idx}",
                sources=sources,
                targets=targets,
            )
        )

    def _record_source_event(self, side: Side[ScriptRef]) -> None:
        if self._suppress_io_depth > 0:
            return
        self._source_events.append(side)

    def _exec_block(
        self,
        stmts: Sequence[ast.stmt],
        state: _ExecState,
        scope: ast.AST,
        *,
        break_states: list[_ExecState] | None = None,
        continue_states: list[_ExecState] | None = None,
        return_outcomes: list[tuple[_ExecState, _ProvVal]] | None = None,
    ) -> _FlowStatus:
        for stmt in stmts:
            status = self._exec_stmt(
                stmt,
                state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
            if status != "normal":
                return status
        return "normal"

    def _exec_stmt(
        self,
        stmt: ast.stmt,
        state: _ExecState,
        scope: ast.AST,
        *,
        break_states: list[_ExecState] | None = None,
        continue_states: list[_ExecState] | None = None,
        return_outcomes: list[tuple[_ExecState, _ProvVal]] | None = None,
    ) -> _FlowStatus:
        if isinstance(stmt, ast.Assign):
            rhs = self._eval_expr(stmt.value, state, scope)
            for target in stmt.targets:
                self._assign_target(target, rhs, state, scope)
            return "normal"
        if isinstance(stmt, ast.AnnAssign):
            if stmt.value is not None:
                self._assign_target(stmt.target, self._eval_expr(stmt.value, state, scope), state, scope)
            return "normal"
        if isinstance(stmt, ast.AugAssign):
            self._exec_aug_assign(stmt, state, scope)
            return "normal"
        if isinstance(stmt, ast.Delete):
            for target in stmt.targets:
                self._exec_delete(target, state, scope)
            return "normal"
        if isinstance(stmt, ast.Expr):
            self._eval_expr(stmt.value, state, scope)
            return "normal"
        if isinstance(stmt, (ast.Import, ast.ImportFrom)):
            for alias in stmt.names:
                if alias.name != "*":
                    self._bind_name(alias.asname or alias.name.split(".")[0], _OPAQUE_VAL, state, scope)
            return "normal"
        if isinstance(stmt, FUNCTIONS):
            self._capture_function_defaults(stmt, state, scope)
            return "normal"
        return self._exec_control_stmt(
            stmt,
            state,
            scope,
            break_states=break_states,
            continue_states=continue_states,
            return_outcomes=return_outcomes,
        )

    def _capture_function_defaults(
        self,
        fn_def: ast.FunctionDef | ast.AsyncFunctionDef,
        state: _ExecState,
        scope: ast.AST,
    ) -> None:
        reader = self._reader_for(state)
        positional = [*fn_def.args.posonlyargs, *fn_def.args.args]
        default_start = len(positional) - len(fn_def.args.defaults)
        captured: dict[str, tuple[_ProvVal, object]] = {}
        for idx, default_expr in enumerate(fn_def.args.defaults):
            p_name = positional[default_start + idx].arg
            captured[p_name] = (self._eval_expr(default_expr, state, scope), reader.eval_for_override(default_expr))
        for kw_param, kw_default in zip(fn_def.args.kwonlyargs, fn_def.args.kw_defaults, strict=True):
            if kw_default is not None:
                captured[kw_param.arg] = (
                    self._eval_expr(kw_default, state, scope),
                    reader.eval_for_override(kw_default),
                )
        state.fn_defaults[id(fn_def)] = captured

    def _exec_control_stmt(
        self,
        stmt: ast.stmt,
        state: _ExecState,
        scope: ast.AST,
        *,
        break_states: list[_ExecState] | None,
        continue_states: list[_ExecState] | None,
        return_outcomes: list[tuple[_ExecState, _ProvVal]] | None,
    ) -> _FlowStatus:
        if isinstance(stmt, ast.If):
            return self._exec_if(
                stmt,
                state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
        if isinstance(stmt, ast.For):
            return self._exec_for(
                stmt,
                state,
                scope,
                outer_break_states=break_states,
                outer_continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
        if isinstance(stmt, (ast.AsyncFor, ast.While)):
            while_test = stmt.test if isinstance(stmt, ast.While) else None
            return self._exec_dynamic_loop_body(
                stmt.body,
                stmt.orelse,
                None,
                state,
                scope,
                while_test=while_test,
                outer_break_states=break_states,
                outer_continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
        if isinstance(stmt, (ast.With, ast.AsyncWith)):
            for item in stmt.items:
                ctx_val = self._eval_expr(item.context_expr, state, scope)
                if item.optional_vars is not None:
                    self._assign_target(item.optional_vars, ctx_val, state, scope)
            return self._exec_block(
                stmt.body,
                state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
        if isinstance(stmt, ast.Try):
            return self._exec_try(
                stmt,
                state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
        if isinstance(stmt, ast.Break):
            if break_states is not None:
                break_states.append(state.clone())
            return "break"
        if isinstance(stmt, ast.Continue):
            if continue_states is not None:
                continue_states.append(state.clone())
            return "continue"
        if isinstance(stmt, ast.Assert):
            self._eval_condition(stmt.test, state, scope)
            return "normal"
        if isinstance(stmt, ast.Return):
            ret_val = self._eval_expr(stmt.value, state, scope) if stmt.value is not None else _NONE_VAL
            if return_outcomes is not None:
                return_outcomes.append(state.clone_with_val(ret_val))
            return "return"
        return "normal"

    @staticmethod
    def _overwrite_state_in_place(dest: _ExecState, src: _ExecState, carried: _ProvVal = _NONE_VAL) -> _ProvVal:
        if src is not dest:
            carried = _adopt_joined_containers(dest, src, carried)
        dest.scope_envs = src.scope_envs
        dest.loop_overrides = src.loop_overrides
        dest.scope_overrides = src.scope_overrides
        dest.fn_defaults = src.fn_defaults
        dest.temp_views = src.temp_views
        dest.temp_views_opaque = src.temp_views_opaque
        dest.global_temp_views = src.global_temp_views
        dest.global_temp_views_opaque = src.global_temp_views_opaque
        return carried

    @staticmethod
    def _merge_state_list(states: Sequence[_ExecState]) -> _ExecState:
        merged = states[0]
        for extra in states[1:]:
            merged = _join_states(merged, extra)
        return merged

    def _exec_if(
        self,
        stmt: ast.If,
        state: _ExecState,
        scope: ast.AST,
        *,
        break_states: list[_ExecState] | None,
        continue_states: list[_ExecState] | None,
        return_outcomes: list[tuple[_ExecState, _ProvVal]] | None,
    ) -> _FlowStatus:
        cond = self._eval_condition(stmt.test, state, scope)
        if cond is True:
            return self._exec_block(
                stmt.body,
                state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
        if cond is False:
            return self._exec_block(
                stmt.orelse,
                state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )

        then_state = state.clone()
        else_state = state.clone()
        then_status = self._exec_block(
            stmt.body,
            then_state,
            scope,
            break_states=break_states,
            continue_states=continue_states,
            return_outcomes=return_outcomes,
        )
        else_status = self._exec_block(
            stmt.orelse,
            else_state,
            scope,
            break_states=break_states,
            continue_states=continue_states,
            return_outcomes=return_outcomes,
        )
        if then_status == "normal" and else_status == "normal":
            self._overwrite_state_in_place(state, _join_states(then_state, else_state))
            return "normal"
        if then_status == "normal":
            self._overwrite_state_in_place(state, then_state)
            return "normal"
        if else_status == "normal":
            self._overwrite_state_in_place(state, else_state)
            return "normal"
        return then_status if then_status == else_status else "return"

    def _exec_try(
        self,
        stmt: ast.Try,
        state: _ExecState,
        scope: ast.AST,
        *,
        break_states: list[_ExecState] | None,
        continue_states: list[_ExecState] | None,
        return_outcomes: list[tuple[_ExecState, _ProvVal]] | None,
    ) -> _FlowStatus:
        pre_try = state.clone()
        body_status = self._exec_block(
            stmt.body,
            state,
            scope,
            break_states=break_states,
            continue_states=continue_states,
            return_outcomes=return_outcomes,
        )
        if body_status == "normal" and stmt.orelse:
            body_status = self._exec_block(
                stmt.orelse,
                state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
        surviving: list[_ExecState] = [state.clone()] if body_status == "normal" else []
        for handler in stmt.handlers:
            if len(handler.body) == 1 and isinstance(handler.body[0], ast.Raise):
                continue
            h_state = _join_states(pre_try, state)
            if handler.name:
                self._bind_name(handler.name, _OPAQUE_VAL, h_state, scope)
            h_status = self._exec_block(
                handler.body,
                h_state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
            if h_status == "normal":
                surviving.append(h_state)
        if surviving:
            self._overwrite_state_in_place(state, self._merge_state_list(surviving))
            final_status: _FlowStatus = "normal"
        else:
            final_status = body_status
        if stmt.finalbody:
            fin_status = self._exec_block(
                stmt.finalbody,
                state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
            if fin_status != "normal":
                return fin_status
        return final_status

    def _resolve_for_items(self, stmt: ast.For, state: _ExecState, scope: ast.AST) -> list[_ProvVal] | None:
        if isinstance(stmt.iter, (ast.List, ast.Tuple, ast.Set)) and not stmt.iter.elts:
            return []
        reader = self._reader_for(state)
        seq = reader.sequence(stmt.iter)
        if seq is not None:
            return [_ScalarVal(v) for v in seq]

        iter_val = self._eval_expr(stmt.iter, state, scope)
        if isinstance(iter_val, _TupleVal):
            return list(iter_val.items) if len(iter_val.items) <= MAX_LOOP_UNROLLS else None
        if isinstance(iter_val, _ListVal) and not iter_val.opaque:
            return list(iter_val.items) if len(iter_val.items) <= MAX_LOOP_UNROLLS else None
        if (
            isinstance(iter_val, _FrameDict)
            and not iter_val.has_unknown_entries
            and len(iter_val.entries) <= MAX_LOOP_UNROLLS
        ):
            return [_ScalarVal(k) for k in iter_val.entries]
        return None

    @staticmethod
    def _set_loop_override(stmt: ast.For, item: _ProvVal, state: _ExecState) -> None:
        if (
            isinstance(stmt.target, ast.Name)
            and isinstance(item, _ScalarVal)
            and isinstance(item.value, (str, int, float, bool))
        ):
            state.loop_overrides[stmt] = item.value
        else:
            state.loop_overrides.pop(stmt, None)

    def _exec_for(
        self,
        stmt: ast.For,
        state: _ExecState,
        scope: ast.AST,
        *,
        outer_break_states: list[_ExecState] | None = None,
        outer_continue_states: list[_ExecState] | None = None,
        return_outcomes: list[tuple[_ExecState, _ProvVal]] | None,
    ) -> _FlowStatus:
        items = self._resolve_for_items(stmt, state, scope)
        if items is None or self._total_loop_steps + len(items) > MAX_TOTAL_LOOP_STEPS:
            return self._exec_dynamic_loop_body(
                stmt.body,
                stmt.orelse,
                stmt.target,
                state,
                scope,
                loop_node=stmt,
                outer_break_states=outer_break_states,
                outer_continue_states=outer_continue_states,
                return_outcomes=return_outcomes,
            )
        if not items:
            if stmt.orelse:
                return self._exec_block(
                    stmt.orelse,
                    state,
                    scope,
                    break_states=outer_break_states,
                    continue_states=outer_continue_states,
                    return_outcomes=return_outcomes,
                )
            return "normal"

        prev_loop_val = state.loop_overrides.get(stmt)
        break_states: list[_ExecState] = []
        broke_unconditionally = False
        returned_unconditionally = False

        for item in items:
            self._total_loop_steps += 1
            self._set_loop_override(stmt, item, state)
            self._assign_target(stmt.target, item, state, scope, record_scalar_override=True)
            continue_states: list[_ExecState] = []
            iter_status = self._exec_block(
                stmt.body,
                state,
                scope,
                break_states=break_states,
                continue_states=continue_states,
                return_outcomes=return_outcomes,
            )
            if iter_status == "break":
                broke_unconditionally = True
                break
            if iter_status == "return":
                returned_unconditionally = True
                break
            if iter_status == "continue":
                if continue_states:
                    self._overwrite_state_in_place(state, self._merge_state_list(continue_states))
                continue
            if continue_states:
                self._overwrite_state_in_place(state, self._merge_state_list([state, *continue_states]))

        if prev_loop_val is not None:
            state.loop_overrides[stmt] = prev_loop_val
        else:
            state.loop_overrides.pop(stmt, None)

        return self._finalize_unrolled_for(
            stmt,
            state,
            scope,
            break_states=break_states,
            broke_unconditionally=broke_unconditionally,
            returned_unconditionally=returned_unconditionally,
            outer_break_states=outer_break_states,
            outer_continue_states=outer_continue_states,
            return_outcomes=return_outcomes,
        )

    def _finalize_unrolled_for(
        self,
        stmt: ast.For,
        state: _ExecState,
        scope: ast.AST,
        *,
        break_states: list[_ExecState],
        broke_unconditionally: bool,
        returned_unconditionally: bool,
        outer_break_states: list[_ExecState] | None,
        outer_continue_states: list[_ExecState] | None,
        return_outcomes: list[tuple[_ExecState, _ProvVal]] | None,
    ) -> _FlowStatus:
        if returned_unconditionally:
            if break_states:
                self._overwrite_state_in_place(state, self._merge_state_list(break_states))
                return "normal"
            return "return"

        if not broke_unconditionally and stmt.orelse:
            orelse_status = self._exec_block(
                stmt.orelse,
                state,
                scope,
                break_states=outer_break_states,
                continue_states=outer_continue_states,
                return_outcomes=return_outcomes,
            )
            if orelse_status != "normal":
                if break_states:
                    self._overwrite_state_in_place(state, self._merge_state_list(break_states))
                    return "normal"
                return orelse_status

        exit_candidates = break_states if broke_unconditionally else ([state, *break_states] if break_states else [])
        if exit_candidates:
            self._overwrite_state_in_place(state, self._merge_state_list(exit_candidates))
        return "normal"

    def _stabilize_dynamic_loop_entry(
        self,
        body: Sequence[ast.stmt],
        target: ast.AST | None,
        entry: _ExecState,
        scope: ast.AST,
        loop_node: ast.For | None,
    ) -> _ExecState:
        stabilized = entry.clone()
        if self._suppress_io_depth > 0:
            return stabilized
        self._suppress_io_depth += 1
        try:
            for _ in range(2):
                probe = stabilized.clone()
                if loop_node is not None:
                    probe.loop_overrides.pop(loop_node, None)
                if target is not None:
                    self._assign_target(target, _OPAQUE_VAL, probe, scope, record_scalar_override=True)
                p_breaks: list[_ExecState] = []
                p_conts: list[_ExecState] = []
                p_status = self._exec_block(body, probe, scope, break_states=p_breaks, continue_states=p_conts)
                candidates: list[_ExecState] = [entry, *p_conts]
                if p_status == "normal":
                    candidates.append(probe)
                stabilized = self._merge_state_list(candidates)
        finally:
            self._suppress_io_depth -= 1
        return stabilized

    def _exec_dynamic_loop_body(
        self,
        body: Sequence[ast.stmt],
        orelse: Sequence[ast.stmt],
        target: ast.AST | None,
        state: _ExecState,
        scope: ast.AST,
        *,
        loop_node: ast.For | None = None,
        while_test: ast.expr | None = None,
        outer_break_states: list[_ExecState] | None = None,
        outer_continue_states: list[_ExecState] | None = None,
        return_outcomes: list[tuple[_ExecState, _ProvVal]] | None = None,
    ) -> _FlowStatus:
        entry = state.clone()
        enters_initially = while_test is not None and self._eval_condition(while_test, entry, scope) is True
        stabilized = self._stabilize_dynamic_loop_entry(body, target, entry, scope, loop_node)
        iter_state = stabilized.clone()
        if loop_node is not None:
            iter_state.loop_overrides.pop(loop_node, None)
        if target is not None:
            self._assign_target(target, _OPAQUE_VAL, iter_state, scope, record_scalar_override=True)
        b_states: list[_ExecState] = []
        c_states: list[_ExecState] = []
        body_status = self._exec_block(
            body,
            iter_state,
            scope,
            break_states=b_states,
            continue_states=c_states,
            return_outcomes=return_outcomes,
        )
        header_exits = self._collect_dynamic_header_exits(
            entry,
            iter_state,
            c_states,
            body_status=body_status,
            enters_initially=enters_initially,
            while_test=while_test,
            scope=scope,
        )
        return self._finalize_dynamic_loop(
            orelse,
            state,
            scope,
            header_exits=header_exits,
            b_states=b_states,
            body_status=body_status,
            outer_break_states=outer_break_states,
            outer_continue_states=outer_continue_states,
            return_outcomes=return_outcomes,
        )

    def _collect_dynamic_header_exits(
        self,
        entry: _ExecState,
        iter_state: _ExecState,
        c_states: Sequence[_ExecState],
        *,
        body_status: _FlowStatus,
        enters_initially: bool,
        while_test: ast.expr | None,
        scope: ast.AST,
    ) -> list[_ExecState]:
        header_exits: list[_ExecState] = [] if enters_initially else [entry]
        loop_backs: list[_ExecState] = [*c_states, *([iter_state] if body_status == "normal" else [])]
        header_exits.extend(
            cand
            for cand in loop_backs
            if while_test is None or self._eval_condition(while_test, cand, scope) is not True
        )
        return header_exits

    def _finalize_dynamic_loop(
        self,
        orelse: Sequence[ast.stmt],
        state: _ExecState,
        scope: ast.AST,
        *,
        header_exits: Sequence[_ExecState],
        b_states: Sequence[_ExecState],
        body_status: _FlowStatus,
        outer_break_states: list[_ExecState] | None,
        outer_continue_states: list[_ExecState] | None,
        return_outcomes: list[tuple[_ExecState, _ProvVal]] | None,
    ) -> _FlowStatus:
        if not header_exits and not b_states:
            return "return" if body_status == "return" or return_outcomes is not None else "normal"
        if orelse and header_exits:
            orelse_state = self._merge_state_list(header_exits).clone()
            orelse_status = self._exec_block(
                orelse,
                orelse_state,
                scope,
                break_states=outer_break_states,
                continue_states=outer_continue_states,
                return_outcomes=return_outcomes,
            )
            post_states: list[_ExecState] = [*([orelse_state] if orelse_status == "normal" else []), *b_states]
            if not post_states:
                return orelse_status
            self._overwrite_state_in_place(state, self._merge_state_list(post_states))
            return "normal"
        self._overwrite_state_in_place(state, self._merge_state_list([*header_exits, *b_states]))
        return "normal"

    def _bind_name(
        self,
        name: str,
        val: _ProvVal,
        state: _ExecState,
        scope: ast.AST,
        *,
        record_scalar_override: bool = False,
    ) -> None:
        owner = self._bindings.owner_of(scope, name)
        env = state.scope_envs.setdefault(id(owner), {})
        env[name] = val
        override_key = (owner, name)
        is_scalar = isinstance(val, _ScalarVal) and isinstance(val.value, (str, int, float, bool))
        if is_scalar:
            assert isinstance(val, _ScalarVal)
            state.scope_overrides[override_key] = val.value
        elif record_scalar_override or override_key in state.scope_overrides:
            state.scope_overrides[override_key] = UNKNOWN

    def _assign_target(
        self,
        target: ast.AST,
        val: _ProvVal,
        state: _ExecState,
        scope: ast.AST,
        *,
        record_scalar_override: bool = False,
    ) -> None:
        if isinstance(target, ast.Name):
            if not self._bindings.is_shadowed(target):
                self._bind_name(target.id, val, state, scope, record_scalar_override=record_scalar_override)
            return
        if isinstance(target, (ast.Tuple, ast.List)):
            self._assign_sequence_target(target.elts, val, state, scope, record_scalar_override=record_scalar_override)
            return
        if isinstance(target, ast.Subscript):
            self._assign_subscript(target, val, state, scope)

    def _assign_subscript(self, target: ast.Subscript, val: _ProvVal, state: _ExecState, scope: ast.AST) -> None:
        container = self._eval_expr(target.value, state, scope)
        if isinstance(container, _FrameDict):
            if _carries_frame(val):
                container.contains_frames = True
            key = UNKNOWN if isinstance(target.slice, ast.Slice) else self._eval_dict_key(target.slice, state, scope)
            if isinstance(key, UnknownValue) or len(container.entries) >= MAX_CONTAINER_ITEMS:
                container.entries.clear()
                container.has_unknown_entries = True
            else:
                container.entries.pop(key, None)
                container.entries[key] = val
        elif isinstance(container, _ListVal):
            if _carries_frame(val):
                container.contains_frames = True
            idx = None if isinstance(target.slice, ast.Slice) else self._eval_int(target.slice, state, scope)
            if not container.opaque and idx is not None and -len(container.items) <= idx < len(container.items):
                container.items[idx] = val
            else:
                container.items.clear()
                container.opaque = True

    def _assign_sequence_target(
        self,
        elts: Sequence[ast.expr],
        val: _ProvVal,
        state: _ExecState,
        scope: ast.AST,
        *,
        record_scalar_override: bool = False,
    ) -> None:
        seq_items = val.items if isinstance(val, _TupleVal) or (isinstance(val, _ListVal) and not val.opaque) else None
        if seq_items is not None and not any(isinstance(e, ast.Starred) for e in elts) and len(seq_items) == len(elts):
            for elt, item in zip(elts, seq_items, strict=True):
                self._assign_target(elt, item, state, scope, record_scalar_override=record_scalar_override)
            return
        fallback: _ProvVal = _FrameVal("unresolved") if _carries_frame(val) else _OPAQUE_VAL
        for elt in elts:
            inner = elt.value if isinstance(elt, ast.Starred) else elt
            self._assign_target(inner, fallback, state, scope, record_scalar_override=record_scalar_override)

    def _aug_assign_container(
        self, stmt: ast.AugAssign, current: _ProvVal, rhs: _ProvVal, state: _ExecState, scope: ast.AST
    ) -> bool:
        if isinstance(stmt.op, ast.Add) and isinstance(current, _ListVal):
            if _carries_frame(rhs):
                current.contains_frames = True
            rhs_items = (
                list(rhs.items)
                if isinstance(rhs, _TupleVal) or (isinstance(rhs, _ListVal) and not rhs.opaque)
                else None
            )
            if (
                not current.opaque
                and rhs_items is not None
                and len(current.items) + len(rhs_items) <= MAX_CONTAINER_ITEMS
            ):
                current.items.extend(rhs_items)
            else:
                current.items.clear()
                current.opaque = True
            return True
        if isinstance(stmt.op, ast.Add) and isinstance(current, _TupleVal):
            if isinstance(rhs, _TupleVal) and len(current.items) + len(rhs.items) <= MAX_CONTAINER_ITEMS:
                self._assign_target(stmt.target, _TupleVal(current.items + rhs.items), state, scope)
            else:
                fallback = _FrameVal("unresolved") if (_carries_frame(current) or _carries_frame(rhs)) else _OPAQUE_VAL
                self._assign_target(stmt.target, fallback, state, scope)
            return True
        if isinstance(stmt.op, ast.BitOr) and isinstance(current, _FrameDict):
            if (
                isinstance(rhs, _FrameDict)
                and not rhs.has_unknown_entries
                and len(current.entries) + len(rhs.entries) <= MAX_CONTAINER_ITEMS
            ):
                if rhs.contains_frames:
                    current.contains_frames = True
                for k, v in rhs.entries.items():
                    current.entries.pop(k, None)
                    current.entries[k] = v
            else:
                if _carries_frame(rhs):
                    current.contains_frames = True
                current.entries.clear()
                current.has_unknown_entries = True
            return True
        return False

    def _exec_aug_assign(self, stmt: ast.AugAssign, state: _ExecState, scope: ast.AST) -> None:
        current = self._eval_expr(stmt.target, state, scope)
        rhs = self._eval_expr(stmt.value, state, scope)
        if self._aug_assign_container(stmt, current, rhs, state, scope):
            return
        if (
            isinstance(stmt.op, ast.Add)
            and isinstance(current, _ScalarVal)
            and isinstance(rhs, _ScalarVal)
            and isinstance(current.value, str)
            and isinstance(rhs.value, str)
            and len(current.value) + len(rhs.value) <= MAX_STRING_LENGTH
        ):
            self._assign_target(
                stmt.target,
                _ScalarVal(current.value + rhs.value),
                state,
                scope,
                record_scalar_override=True,
            )
            return
        if isinstance(current, _ListVal):
            current.items.clear()
            current.opaque = True
        elif isinstance(current, _FrameDict):
            current.entries.clear()
            current.has_unknown_entries = True
        fallback = _FrameVal("unresolved") if (_carries_frame(current) or _carries_frame(rhs)) else _OPAQUE_VAL
        self._assign_target(stmt.target, fallback, state, scope, record_scalar_override=True)

    def _exec_delete(self, target: ast.AST, state: _ExecState, scope: ast.AST) -> None:
        if isinstance(target, ast.Name) and not self._bindings.is_shadowed(target):
            owner = self._bindings.owner_of(scope, target.id)
            env = state.scope_envs.get(id(owner))
            if env is not None:
                env.pop(target.id, None)
            state.scope_overrides.pop((owner, target.id), None)
        elif isinstance(target, ast.Subscript):
            container = self._eval_expr(target.value, state, scope)
            if isinstance(container, _FrameDict):
                key = (
                    UNKNOWN if isinstance(target.slice, ast.Slice) else self._eval_dict_key(target.slice, state, scope)
                )
                if isinstance(key, UnknownValue):
                    container.entries.clear()
                    container.has_unknown_entries = True
                else:
                    container.entries.pop(key, None)
            elif isinstance(container, _ListVal):
                idx = None if isinstance(target.slice, ast.Slice) else self._eval_int(target.slice, state, scope)
                if not container.opaque and idx is not None and -len(container.items) <= idx < len(container.items):
                    container.items.pop(idx)
                else:
                    container.items.clear()
                    container.opaque = True

    def _eval_dict_key(
        self, node: ast.expr | None, state: _ExecState, scope: ast.AST, evaluated: _ProvVal | None = None
    ) -> DictKey | UnknownValue:
        if node is None:
            return UNKNOWN
        dk = self._reader_for(state).dict_key(node)
        if not isinstance(dk, UnknownValue):
            return dk
        return _dict_key_of_val(self._eval_expr(node, state, scope) if evaluated is None else evaluated)

    def _eval_int(
        self, node: ast.expr | None, state: _ExecState, scope: ast.AST, evaluated: _ProvVal | None = None
    ) -> int | None:
        if node is None:
            return None
        iv = self._reader_for(state).int_value(node)
        if iv is not None:
            return iv
        val = self._eval_expr(node, state, scope) if evaluated is None else evaluated
        if isinstance(val, _ScalarVal) and isinstance(val.value, int) and not isinstance(val.value, bool):
            return val.value
        return None

    def _eval_condition(self, test: ast.expr, state: _ExecState, scope: ast.AST) -> bool | None:
        if isinstance(test, ast.Constant):
            return bool(test.value)
        if isinstance(test, ast.Name):
            return _truthiness(self._eval_expr(test, state, scope))
        if isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not):
            inner = self._eval_condition(test.operand, state, scope)
            return (not inner) if inner is not None else None
        if isinstance(test, ast.BoolOp):
            return self._eval_bool_op(test, state, scope)
        if isinstance(test, ast.Compare):
            return self._eval_compare(test, state, scope)
        self._eval_expr(test, state, scope)
        return None

    def _eval_compare(self, test: ast.Compare, state: _ExecState, scope: ast.AST) -> bool | None:
        if len(test.ops) == 1:
            return self._eval_single_compare(test.left, test.ops[0], test.comparators[0], state, scope)

        # A chain reuses the middle operand. After an unknown link, the remaining effects are conditional.
        active = state
        skipped: _ExecState | None = None
        result: bool | None = True
        left = self._eval_comparison_key(test.left, active, scope)
        for index, (op, right_expr) in enumerate(zip(test.ops, test.comparators, strict=True)):
            right = self._eval_comparison_key(right_expr, active, scope)
            link = _compare_known_keys(left, op, right)
            if link is False:
                result = False
                break
            if link is None:
                result = None
                if index < len(test.ops) - 1:
                    active, skipped = self._fork_optional_state(active, skipped)
            left = right
        if skipped is not None:
            self._overwrite_state_in_place(state, _join_states(skipped, active))
        return result

    def _eval_comparison_key(self, expr: ast.expr, state: _ExecState, scope: ast.AST) -> DictKey | UnknownValue:
        value = _dict_key_of_val(self._eval_expr(expr, state, scope))
        return self._reader_for(state).dict_key(expr) if isinstance(value, UnknownValue) else value

    @staticmethod
    def _fork_optional_state(active: _ExecState, skipped: _ExecState | None) -> tuple[_ExecState, _ExecState]:
        if skipped is None:
            return active.clone(), active
        return active, _join_states(skipped, active)

    def _eval_bool_op(self, test: ast.BoolOp, state: _ExecState, scope: ast.AST) -> bool | None:
        stops_on = isinstance(test.op, ast.Or)
        result: bool | None = not stops_on
        active = state
        skipped: _ExecState | None = None
        for index, operand in enumerate(test.values):
            value = self._eval_condition(operand, active, scope)
            if value is stops_on:
                result = stops_on
                break
            if value is None:
                result = None
                if index < len(test.values) - 1:
                    active, skipped = self._fork_optional_state(active, skipped)
        if skipped is not None:
            self._overwrite_state_in_place(state, _join_states(skipped, active))
        return result

    def _eval_single_compare(
        self,
        left_expr: ast.expr,
        op: ast.cmpop,
        right_expr: ast.expr,
        state: _ExecState,
        scope: ast.AST,
    ) -> bool | None:
        if (
            isinstance(op, (ast.Eq, ast.NotEq))
            and isinstance(left_expr, ast.Name)
            and left_expr.id == "__name__"
            and not self._bindings.has_binding_in_scope(scope, "__name__")
            and isinstance(right_expr, ast.Constant)
            and isinstance(right_expr.value, str)
        ):
            eq = right_expr.value == "__main__"
            return eq if isinstance(op, ast.Eq) else not eq

        if isinstance(op, (ast.Is, ast.IsNot)):
            return self._eval_is_none_compare(left_expr, op, right_expr, state, scope)
        if isinstance(op, (ast.In, ast.NotIn)):
            return self._eval_membership_compare(left_expr, op, right_expr, state, scope)
        return _compare_known_keys(
            self._eval_comparison_key(left_expr, state, scope),
            op,
            self._eval_comparison_key(right_expr, state, scope),
        )

    def _eval_is_none_compare(
        self,
        left_expr: ast.expr,
        op: ast.cmpop,
        right_expr: ast.expr,
        state: _ExecState,
        scope: ast.AST,
    ) -> bool | None:
        left_is_none = isinstance(left_expr, ast.Constant) and left_expr.value is None
        right_is_none = isinstance(right_expr, ast.Constant) and right_expr.value is None
        if not (left_is_none or right_is_none):
            self._eval_expr(left_expr, state, scope)
            self._eval_expr(right_expr, state, scope)
            return None
        other_val = self._eval_expr(right_expr if left_is_none else left_expr, state, scope)
        if isinstance(other_val, (_OpaqueVal, _UnboundVal)):
            return None
        if isinstance(other_val, _FrameVal) and other_val.side == "unresolved":
            return None
        definitely_none = isinstance(other_val, _ScalarVal) and other_val.value is None
        return definitely_none if isinstance(op, ast.Is) else not definitely_none

    def _eval_membership_compare(
        self,
        left_expr: ast.expr,
        op: ast.cmpop,
        right_expr: ast.expr,
        state: _ExecState,
        scope: ast.AST,
    ) -> bool | None:
        key = self._eval_comparison_key(left_expr, state, scope)
        container = self._eval_expr(right_expr, state, scope)
        if isinstance(key, UnknownValue):
            return None
        if isinstance(container, _FrameDict):
            if key in container.entries:
                present = True
            elif container.has_unknown_entries:
                return None
            else:
                present = False
            return present if isinstance(op, ast.In) else not present
        if isinstance(container, (_ListVal, _TupleVal)) and not (isinstance(container, _ListVal) and container.opaque):
            if any(isinstance(item, _ScalarVal) and item.value == key for item in container.items):
                return isinstance(op, ast.In)
            if all(isinstance(item, _ScalarVal) for item in container.items):
                return isinstance(op, ast.NotIn)
        seq = self._reader_for(state).sequence(right_expr)
        if seq is not None:
            present = any(item == key for item in seq)
            return present if isinstance(op, ast.In) else not present
        return None

    def _eval_expr(
        self,
        node: ast.expr | None,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal:
        if node is None or self._expr_depth >= MAX_EXPR_DEPTH:
            return _OPAQUE_VAL
        self._expr_depth += 1
        try:
            if isinstance(node, ast.Constant):
                if node.value is None:
                    return _NONE_VAL
                dk = self._reader_for(state).dict_key(node)
                return _ScalarVal(dk) if not isinstance(dk, UnknownValue) else _OPAQUE_VAL
            if isinstance(node, ast.Name):
                return self._eval_name(node, state, scope)
            if isinstance(node, ast.Subscript):
                return self._eval_subscript(node, state, scope)
            if isinstance(node, ast.BinOp):
                return self._eval_binop(node, state, scope)
            if isinstance(node, ast.Call):
                return self._eval_call(node, state, scope)
            if isinstance(node, ast.Attribute):
                recv = self._eval_expr(node.value, state, scope)
                if node.attr == "emptyDataFrame":
                    return _FrameVal("absent")
                return recv if isinstance(recv, _FrameVal) else _OPAQUE_VAL
            if isinstance(node, ast.JoinedStr):
                for part in node.values:
                    if isinstance(part, ast.FormattedValue):
                        self._eval_compound_expr(part, state, scope)
                s = self._reader_for(state).string(node)
                return _ScalarVal(s) if isinstance(s, str) else _OPAQUE_VAL
            return self._eval_compound_expr(node, state, scope)
        finally:
            self._expr_depth -= 1

    def _eval_compound_expr(self, node: ast.expr, state: _ExecState, scope: ast.AST) -> _ProvVal:
        if isinstance(node, ast.Tuple):
            return self._eval_tuple(node, state, scope)
        if isinstance(node, ast.List):
            return self._eval_list(node, state, scope)
        if isinstance(node, ast.Dict):
            return self._eval_dict_literal(node, state, scope)
        if isinstance(node, ast.IfExp):
            cond = self._eval_condition(node.test, state, scope)
            if cond is True:
                return self._eval_expr(node.body, state, scope)
            if cond is False:
                return self._eval_expr(node.orelse, state, scope)
            return _join_alternatives(
                [self._eval_expr(node.body, state, scope), self._eval_expr(node.orelse, state, scope)]
            )
        if isinstance(node, ast.NamedExpr):
            val = self._eval_expr(node.value, state, scope)
            self._assign_target(node.target, val, state, scope)
            return val
        if isinstance(node, ast.BoolOp):
            return self._eval_bool_op_value(node, state, scope)
        if isinstance(node, ast.Compare) or (isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not)):
            truth = self._eval_condition(node, state, scope)
            return _OPAQUE_VAL if truth is None else _ScalarVal(truth)
        if isinstance(node, COMPREHENSIONS):
            return self._eval_comprehension(node, state, scope)
        if not isinstance(node, ast.Lambda):
            # Unmodelled expressions (`-x`, `await`, f-string placeholders, ...) still execute their operands' calls.
            for child in ast.iter_child_nodes(node):
                if isinstance(child, ast.expr):
                    self._eval_expr(child, state, scope)
        return _OPAQUE_VAL

    def _eval_bool_op_value(self, node: ast.BoolOp, state: _ExecState, scope: ast.AST) -> _ProvVal:
        # Python yields the operand that decided the result; operands after a known short-circuit never run.
        stops_on = isinstance(node.op, ast.Or)
        active = state
        skipped: _ExecState | None = None
        candidates: list[_ProvVal] = []
        for idx, operand in enumerate(node.values):
            val = self._eval_expr(operand, active, scope)
            truth = _truthiness(val)
            is_last = idx == len(node.values) - 1
            if truth is None or truth is stops_on or is_last:
                candidates.append(val)
            if truth is stops_on:
                break
            if truth is None and not is_last:
                active, skipped = self._fork_optional_state(active, skipped)
        value = _join_alternatives(candidates)
        if skipped is not None:
            self._overwrite_state_in_place(state, _join_states(skipped, active))
        return value

    def _eval_comprehension(
        self,
        node: ast.ListComp | ast.SetComp | ast.GeneratorExp | ast.DictComp,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal:
        active = state
        skipped: _ExecState | None = None
        reaches_element = True
        for index, gen in enumerate(node.generators):
            item_count = self._comprehension_item_count(gen.iter, active, scope)
            if item_count == 0:
                reaches_element = False
                break
            # One probe cannot represent repeated effects, and a generator's body may never be consumed.
            if item_count != 1 or (index == 0 and isinstance(node, ast.GeneratorExp)):
                active, skipped = self._fork_optional_state(active, skipped)
            for cond in gen.ifs:
                passed = self._eval_condition(cond, active, scope)
                if passed is False:
                    reaches_element = False
                    break
                if passed is None:
                    active, skipped = self._fork_optional_state(active, skipped)
            if not reaches_element:
                break
        probe: _ProvVal = _OPAQUE_VAL
        if reaches_element:
            if isinstance(node, ast.DictComp):
                self._eval_expr(node.key, active, scope)
            probe = self._eval_expr(node.value if isinstance(node, ast.DictComp) else node.elt, active, scope)
        if skipped is not None:
            self._overwrite_state_in_place(state, _join_states(skipped, active))
        if isinstance(node, ast.DictComp):
            return _FrameDict(entries={}, has_unknown_entries=True, contains_frames=_carries_frame(probe))
        return _ListVal([], opaque=True, contains_frames=_carries_frame(probe))

    def _comprehension_item_count(self, expr: ast.expr, state: _ExecState, scope: ast.AST) -> int | None:
        value = self._eval_expr(expr, state, scope)
        if isinstance(value, _TupleVal) or (isinstance(value, _ListVal) and not value.opaque):
            return len(value.items)
        if isinstance(value, _FrameDict) and not value.has_unknown_entries:
            return len(value.entries)
        if isinstance(value, _ScalarVal) and isinstance(value.value, str):
            return len(value.value)
        sequence = self._reader_for(state).sequence(expr, allow_empty_range=True)
        return None if sequence is None else len(sequence)

    def _eval_name(self, node: ast.Name, state: _ExecState, scope: ast.AST) -> _ProvVal:
        if self._bindings.is_shadowed(node):
            return _OPAQUE_VAL
        owner = self._bindings.owner_of(scope, node.id)
        env = state.scope_envs.get(id(owner))
        if env is not None and node.id in env:
            return env[node.id]
        dk = self._reader_for(state).dict_key(node)
        if not isinstance(dk, UnknownValue):
            return _ScalarVal(dk)
        if not self._bindings.has_binding_in_scope(scope, node.id):
            return _UNBOUND_VAL
        return _OPAQUE_VAL

    def _expand_seq_elements(
        self,
        elts: Sequence[ast.expr],
        state: _ExecState,
        scope: ast.AST,
    ) -> tuple[list[_ProvVal], bool, bool]:
        items: list[_ProvVal] = []
        opaque = len(elts) > MAX_CONTAINER_ITEMS
        contains_frames = False
        if not opaque:
            for elt in elts:
                if isinstance(elt, ast.Starred):
                    sub = self._eval_expr(elt.value, state, scope)
                    if _carries_frame(sub):
                        contains_frames = True
                    if isinstance(sub, _TupleVal) or (isinstance(sub, _ListVal) and not sub.opaque):
                        items.extend(sub.items)
                    else:
                        opaque = True
                else:
                    v = self._eval_expr(elt, state, scope)
                    if _carries_frame(v):
                        contains_frames = True
                    items.append(v)
        if len(items) > MAX_CONTAINER_ITEMS:
            opaque = True
        return items, opaque, contains_frames

    def _eval_tuple(self, node: ast.Tuple, state: _ExecState, scope: ast.AST) -> _ProvVal:
        items, opaque, contains_frames = self._expand_seq_elements(node.elts, state, scope)
        if opaque:
            return _FrameVal("unresolved") if contains_frames else _OPAQUE_VAL
        return _TupleVal(tuple(items))

    def _eval_list(self, node: ast.List, state: _ExecState, scope: ast.AST) -> _ListVal:
        items, opaque, contains_frames = self._expand_seq_elements(node.elts, state, scope)
        if opaque:
            return _ListVal(items=[], opaque=True, contains_frames=contains_frames)
        return _ListVal(items=items, opaque=False, contains_frames=contains_frames)

    def _eval_dict_literal(self, node: ast.Dict, state: _ExecState, scope: ast.AST) -> _FrameDict:
        entries: dict[DictKey, _ProvVal] = {}
        has_unk = len(node.keys) > MAX_CONTAINER_ITEMS
        contains_frames = False
        if not has_unk:
            for k_node, v_node in zip(node.keys, node.values, strict=True):
                val = self._eval_expr(v_node, state, scope)
                if _carries_frame(val):
                    contains_frames = True
                if k_node is None:
                    has_unk = self._unpack_dict_entry(v_node, val, entries, state) or has_unk
                else:
                    key = self._eval_dict_key(k_node, state, scope)
                    if isinstance(key, UnknownValue):
                        entries.clear()
                        has_unk = True
                    else:
                        entries.pop(key, None)
                        entries[key] = val
        if len(entries) > MAX_CONTAINER_ITEMS:
            entries.clear()
            has_unk = True
        return _FrameDict(entries=entries, has_unknown_entries=has_unk, contains_frames=contains_frames)

    def _unpack_dict_entry(
        self,
        v_node: ast.expr,
        val: _ProvVal,
        entries: dict[DictKey, _ProvVal],
        state: _ExecState,
    ) -> bool:
        if isinstance(val, _FrameDict):
            if val.has_unknown_entries:
                entries.clear()
            for k, v in val.entries.items():
                entries.pop(k, None)
                entries[k] = v
            return val.has_unknown_entries
        dv = self._reader_for(state).dict_value(v_node)
        if dv.opaque:
            entries.clear()
        for k, raw_v in dv.entries.items():
            entries.pop(k, None)
            s = ScriptReader.scalar_to_str(raw_v)
            entries[k] = (
                _ScalarVal(raw_v)  # type: ignore[arg-type]
                if isinstance(raw_v, (str, int, float, bool)) and isinstance(s, str)
                else _OPAQUE_VAL
            )
        return dv.opaque

    def _eval_subscript(self, node: ast.Subscript, state: _ExecState, scope: ast.AST) -> _ProvVal:
        container = self._eval_expr(node.value, state, scope)
        # Evaluated once here so calls in a key or slice bound run even when the container is not tracked.
        slice_val = self._eval_expr(node.slice, state, scope)
        if isinstance(container, _FrameDict):
            key = (
                UNKNOWN
                if isinstance(node.slice, ast.Slice)
                else self._eval_dict_key(node.slice, state, scope, slice_val)
            )
            if not isinstance(key, UnknownValue) and key in container.entries:
                return container.entries[key]
            return _FrameVal("unresolved")
        if isinstance(container, (_ListVal, _TupleVal)):
            is_opaque = isinstance(container, _ListVal) and container.opaque
            if not isinstance(node.slice, ast.Slice) and not is_opaque:
                idx = self._eval_int(node.slice, state, scope, slice_val)
                if idx is not None and -len(container.items) <= idx < len(container.items):
                    return container.items[idx]
            return _FrameVal("unresolved") if _carries_frame(container) else _OPAQUE_VAL
        if isinstance(container, _FrameVal):
            # `df[["c1", "c2"]]` projects columns on a DataFrame; `df["col"]` yields a Column expression
            return container if isinstance(node.slice, (ast.List, ast.Tuple)) else _OPAQUE_VAL
        dk = self._reader_for(state).dict_key(node)
        return _ScalarVal(dk) if not isinstance(dk, UnknownValue) else _OPAQUE_VAL

    def _eval_binop(self, node: ast.BinOp, state: _ExecState, scope: ast.AST) -> _ProvVal:
        left = self._eval_expr(node.left, state, scope)
        right = self._eval_expr(node.right, state, scope)
        if isinstance(node.op, ast.Add):
            if isinstance(left, _TupleVal) and isinstance(right, _TupleVal):
                if len(left.items) + len(right.items) <= MAX_CONTAINER_ITEMS:
                    return _TupleVal(left.items + right.items)
                return _FrameVal("unresolved") if (_carries_frame(left) or _carries_frame(right)) else _OPAQUE_VAL
            if isinstance(left, _ListVal) and isinstance(right, _ListVal):
                contains = left.contains_frames or right.contains_frames
                if not left.opaque and not right.opaque and len(left.items) + len(right.items) <= MAX_CONTAINER_ITEMS:
                    return _ListVal(left.items + right.items, opaque=False, contains_frames=contains)
                return _ListVal([], opaque=True, contains_frames=contains)
        if isinstance(node.op, ast.BitOr) and isinstance(left, _FrameDict) and isinstance(right, _FrameDict):
            has_unk = left.has_unknown_entries or right.has_unknown_entries
            entries = {} if right.has_unknown_entries else dict(left.entries)
            for k, v in right.entries.items():
                entries.pop(k, None)
                entries[k] = v
            return _FrameDict(
                entries=entries,
                has_unknown_entries=has_unk,
                contains_frames=left.contains_frames or right.contains_frames,
            )
        dk = self._reader_for(state).dict_key(node)
        return _ScalarVal(dk) if not isinstance(dk, UnknownValue) else _OPAQUE_VAL

    def _try_extract_io_call(self, call: ast.Call, state: _ExecState, scope: ast.AST) -> _ProvVal | None:
        reader = self._reader_for(state)
        table_arg = _is_spark_table_read_call(call)
        if table_arg is not None:
            return self._eval_spark_table_read(table_arg, reader, state)

        call_result = ScriptLineageResult()
        _extract_ast_call(call, reader, self._snowflake_fallback, call_result)
        if call_result.has_target_calls:
            _, tgt_side = call_result.to_sides()
            frame_expr = _target_frame_expr(call)
            src_side: Side[ScriptRef] = (
                "absent" if frame_expr is None else _as_required_frame_side(self._eval_expr(frame_expr, state, scope))
            )
            self._record_target_group(src_side, tgt_side)
            return _NONE_VAL
        if call_result.has_source_calls:
            src_side, _ = call_result.to_sides()
            self._record_source_event(src_side)
            return _FrameVal(src_side)
        return None

    def _eval_spark_table_read(self, table_arg: ast.expr, reader: ScriptReader, state: _ExecState) -> _FrameVal:
        table_ref = reader.string(table_arg)
        if not isinstance(table_ref, str) or not table_ref:
            self._record_source_event("unresolved")
            return _FrameVal("unresolved")
        parts = [p.strip('"`') for p in table_ref.split(".")]
        if len(parts) == 1:
            vkey = parts[0].lower()
            if vkey in state.temp_views:
                return _FrameVal(state.temp_views[vkey])
            if state.temp_views_opaque:
                self._record_source_event("unresolved")
                return _FrameVal("unresolved")
        elif len(parts) == 2 and parts[0].lower() == "global_temp":
            gkey = parts[1].lower()
            if gkey in state.global_temp_views:
                return _FrameVal(state.global_temp_views[gkey])
            if state.global_temp_views_opaque:
                self._record_source_event("unresolved")
                return _FrameVal("unresolved")
        cat_side: Side[ScriptRef] = Resolved((_catalog_ref_from_table_name(table_ref),))
        self._record_source_event(cat_side)
        return _FrameVal(cat_side)

    def _eval_special_attr_call(
        self,
        call: ast.Call,
        func: ast.Attribute,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal | None:
        attr = func.attr
        if attr in TEMP_VIEW_METHODS:
            return self._exec_temp_view_registration(call, attr, state, scope)
        if attr in ("dropTempView", "dropGlobalTempView"):
            return self._exec_drop_temp_view(call, attr, state)
        if attr == "sql":
            self._eval_expr(func.value, state, scope)
            if len(call.args) != 1 or call.keywords:
                return _FrameVal("unresolved")
            sql_text = self._reader_for(state).string(call.args[0])
            if not isinstance(sql_text, str) or not sql_text.strip():
                return _FrameVal("unresolved")
            return _resolve_spark_sql(sql_text, state)
        if attr in IN_MEMORY_FRAME_CONSTRUCTORS or (
            attr == "range" and isinstance(func.value, ast.Name) and func.value.id in ("spark", "sqlContext")
        ):
            return _FrameVal("absent")
        return None

    def _eval_call(self, call: ast.Call, state: _ExecState, scope: ast.AST) -> _ProvVal:
        io_val = self._try_extract_io_call(call, state, scope)
        if io_val is not None:
            return io_val

        if isinstance(call.func, ast.Attribute):
            special = self._eval_special_attr_call(call, call.func, state, scope)
            if special is not None:
                return special

        if (
            isinstance(call.func, ast.Name)
            and call.func.id == "dict"
            and not self._bindings.is_shadowed(call.func)
            and not self._bindings.has_binding_in_scope(scope, "dict")
        ):
            return self._eval_dict_constructor(call, state, scope)

        fn_def = self._bindings.resolve_function_def(call.func)
        if fn_def is not None:
            return self._invoke_helper_function(fn_def, call, state, scope)

        if isinstance(call.func, ast.Attribute):
            return self._eval_receiver_method_call(call, call.func, state, scope)

        if isinstance(call.func, ast.Name) and call.func.id == "reduce":
            return self._eval_reduce_call(call, state, scope)

        return self._eval_general_transform_call(None, call, state, scope)

    def _eval_receiver_method_call(
        self,
        call: ast.Call,
        func: ast.Attribute,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal:
        recv = self._eval_expr(func.value, state, scope)
        if isinstance(recv, _FrameDict):
            return self._eval_frame_dict_method(recv, func.attr, call, state, scope)
        if isinstance(recv, _ListVal):
            return self._eval_list_method(recv, func.attr, call, state, scope)
        if isinstance(recv, _FrameVal) and func.attr in SPARK_BINARY_FRAME_METHODS:
            return self._eval_binary_frame_method(recv, call, state, scope)
        if func.attr == "apply" and isinstance(func.value, ast.Name) and func.value.id == "Join":
            return self._eval_glue_join_apply(call, state, scope)
        if func.attr == "reduce":
            return self._eval_reduce_call(call, state, scope)
        return self._eval_general_transform_call(recv, call, state, scope)

    def _exec_temp_view_registration(
        self,
        call: ast.Call,
        attr: str,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal:
        assert isinstance(call.func, ast.Attribute)
        recv_val = self._eval_expr(call.func.value, state, scope)
        src_side = _as_required_frame_side(recv_val)
        args = _call_args_map(call, ("name",))
        name_expr = args.get("name")
        view_name = self._reader_for(state).string(name_expr) if name_expr is not None else UNKNOWN
        is_global = "Global" in attr
        is_replace = "OrReplace" in attr or attr == "registerTempTable"
        target_map = state.global_temp_views if is_global else state.temp_views

        if not isinstance(view_name, str) or not view_name:
            target_map.clear()
            if is_global:
                state.global_temp_views_opaque = True
            else:
                state.temp_views_opaque = True
            return _NONE_VAL

        key = view_name.lower()
        already_opaque = state.global_temp_views_opaque if is_global else state.temp_views_opaque
        target_map[key] = "unresolved" if (not is_replace and (key in target_map or already_opaque)) else src_side
        return _NONE_VAL

    def _exec_drop_temp_view(self, call: ast.Call, attr: str, state: _ExecState) -> _ProvVal:
        args = _call_args_map(call, ("viewName",))
        name_expr = args.get("viewName")
        view_name = self._reader_for(state).string(name_expr) if name_expr is not None else UNKNOWN
        is_global = attr == "dropGlobalTempView"
        target_map = state.global_temp_views if is_global else state.temp_views
        if isinstance(view_name, str) and view_name:
            target_map.pop(view_name.lower(), None)
        else:
            target_map.clear()
            if is_global:
                state.global_temp_views_opaque = True
            else:
                state.temp_views_opaque = True
        return _NONE_VAL

    def _eval_dict_constructor(self, call: ast.Call, state: _ExecState, scope: ast.AST) -> _FrameDict:
        entries: dict[DictKey, _ProvVal] = {}
        has_unk = len(call.args) > 1
        contains_frames = False
        if len(call.args) == 1:
            arg_val = self._eval_expr(call.args[0], state, scope)
            if isinstance(arg_val, _FrameDict):
                contains_frames = arg_val.contains_frames
                if arg_val.has_unknown_entries:
                    has_unk = True
                else:
                    entries.update(arg_val.entries)
            else:
                has_unk = True
        for kw in call.keywords:
            val = self._eval_expr(kw.value, state, scope)
            if _carries_frame(val):
                contains_frames = True
            if kw.arg is None:
                if (
                    isinstance(val, _FrameDict)
                    and not val.has_unknown_entries
                    and all(isinstance(k, str) for k in val.entries)
                ):
                    for k, v in val.entries.items():
                        entries.pop(k, None)
                        entries[k] = v
                else:
                    entries.clear()
                    has_unk = True
            else:
                entries.pop(kw.arg, None)
                entries[kw.arg] = val
        return _FrameDict(entries=entries, has_unknown_entries=has_unk, contains_frames=contains_frames)

    def _eval_frame_dict_method(
        self,
        recv: _FrameDict,
        attr: str,
        call: ast.Call,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal:
        if attr == "get":
            return self._dict_get(recv, call, state, scope)
        if attr == "setdefault":
            return self._dict_setdefault(recv, call, state, scope)
        if attr == "pop":
            return self._dict_pop(recv, call, state, scope)
        if attr == "clear" and not call.args and not call.keywords:
            recv.entries.clear()
            recv.has_unknown_entries = False
            recv.contains_frames = False
            return _NONE_VAL
        if attr == "update":
            return self._dict_update(recv, call, state, scope)
        if not call.args and not call.keywords and attr in ("values", "keys", "items"):
            return self._dict_view_items(recv, attr)
        return _FrameVal("unresolved") if _carries_frame(recv) else _OPAQUE_VAL

    def _dict_get(self, recv: _FrameDict, call: ast.Call, state: _ExecState, scope: ast.AST) -> _ProvVal:
        if call.keywords or not (1 <= len(call.args) <= 2):
            return _FrameVal("unresolved")
        key = self._eval_dict_key(call.args[0], state, scope)
        default_val = self._eval_expr(call.args[1], state, scope) if len(call.args) == 2 else _NONE_VAL
        if isinstance(key, UnknownValue):
            return _FrameVal("unresolved")
        if key in recv.entries:
            return recv.entries[key]
        return _FrameVal("unresolved") if recv.has_unknown_entries else default_val

    def _dict_setdefault(self, recv: _FrameDict, call: ast.Call, state: _ExecState, scope: ast.AST) -> _ProvVal:
        if call.keywords or not (1 <= len(call.args) <= 2):
            recv.entries.clear()
            recv.has_unknown_entries = True
            return _FrameVal("unresolved")
        key = self._eval_dict_key(call.args[0], state, scope)
        default_val = self._eval_expr(call.args[1], state, scope) if len(call.args) == 2 else _NONE_VAL
        if _carries_frame(default_val):
            recv.contains_frames = True
        if isinstance(key, UnknownValue) or len(recv.entries) >= MAX_CONTAINER_ITEMS:
            recv.entries.clear()
            recv.has_unknown_entries = True
            return _FrameVal("unresolved")
        if key in recv.entries:
            return recv.entries[key]
        if recv.has_unknown_entries:
            recv.entries.pop(key, None)
            return _FrameVal("unresolved")
        recv.entries[key] = default_val
        return default_val

    def _dict_pop(self, recv: _FrameDict, call: ast.Call, state: _ExecState, scope: ast.AST) -> _ProvVal:
        if call.keywords or not (1 <= len(call.args) <= 2):
            recv.entries.clear()
            recv.has_unknown_entries = True
            return _FrameVal("unresolved")
        key = self._eval_dict_key(call.args[0], state, scope)
        default_val = self._eval_expr(call.args[1], state, scope) if len(call.args) == 2 else _FrameVal("unresolved")
        if isinstance(key, UnknownValue):
            recv.entries.clear()
            recv.has_unknown_entries = True
            return _FrameVal("unresolved")
        if key in recv.entries:
            return recv.entries.pop(key)
        return _FrameVal("unresolved") if recv.has_unknown_entries else default_val

    def _dict_update(self, recv: _FrameDict, call: ast.Call, state: _ExecState, scope: ast.AST) -> _ProvVal:
        updated = self._eval_dict_constructor(call, state, scope)
        if updated.contains_frames:
            recv.contains_frames = True
        if updated.has_unknown_entries or len(recv.entries) + len(updated.entries) > MAX_CONTAINER_ITEMS:
            recv.entries.clear()
            recv.has_unknown_entries = True
        else:
            for k, v in updated.entries.items():
                recv.entries.pop(k, None)
                recv.entries[k] = v
        return _NONE_VAL

    @staticmethod
    def _dict_view_items(recv: _FrameDict, attr: str) -> _ListVal:
        if recv.has_unknown_entries:
            return _ListVal(
                [], opaque=True, contains_frames=(attr != "keys" and (recv.contains_frames or attr == "values"))
            )
        if attr == "keys":
            return _ListVal([_ScalarVal(k) for k in recv.entries], opaque=False)
        if attr == "values":
            vals = list(recv.entries.values())
            return _ListVal(
                vals, opaque=False, contains_frames=recv.contains_frames or any(_carries_frame(x) for x in vals)
            )
        pairs: list[_ProvVal] = [_TupleVal((_ScalarVal(k), v)) for k, v in recv.entries.items()]
        return _ListVal(pairs, opaque=False, contains_frames=recv.contains_frames)

    def _eval_list_method(
        self,
        recv: _ListVal,
        attr: str,
        call: ast.Call,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal:
        if attr == "append" and len(call.args) == 1 and not call.keywords:
            val = self._eval_expr(call.args[0], state, scope)
            if _carries_frame(val):
                recv.contains_frames = True
            if not recv.opaque and len(recv.items) < MAX_CONTAINER_ITEMS:
                recv.items.append(val)
            else:
                recv.items.clear()
                recv.opaque = True
            return _NONE_VAL

        if attr == "extend" and len(call.args) == 1 and not call.keywords:
            return self._list_extend(recv, call.args[0], state, scope)

        if attr == "insert" and len(call.args) == 2 and not call.keywords:
            idx = self._eval_int(call.args[0], state, scope)
            val = self._eval_expr(call.args[1], state, scope)
            if _carries_frame(val):
                recv.contains_frames = True
            if not recv.opaque and idx is not None and len(recv.items) < MAX_CONTAINER_ITEMS:
                recv.items.insert(idx, val)
            else:
                recv.items.clear()
                recv.opaque = True
            return _NONE_VAL

        if attr == "pop" and not call.keywords and len(call.args) <= 1:
            return self._list_pop(recv, call, state, scope)

        if attr == "clear" and not call.args and not call.keywords:
            recv.items.clear()
            recv.opaque = False
            recv.contains_frames = False
            return _NONE_VAL

        for arg in call.args:
            self._eval_expr(arg, state, scope)
        recv.items.clear()
        recv.opaque = True
        return _FrameVal("unresolved") if recv.contains_frames else _OPAQUE_VAL

    def _list_extend(self, recv: _ListVal, seq_arg: ast.expr, state: _ExecState, scope: ast.AST) -> _ProvVal:
        seq = self._eval_expr(seq_arg, state, scope)
        if _carries_frame(seq):
            recv.contains_frames = True
        ext_items = (
            list(seq.items) if isinstance(seq, _TupleVal) or (isinstance(seq, _ListVal) and not seq.opaque) else None
        )
        if not recv.opaque and ext_items is not None and len(recv.items) + len(ext_items) <= MAX_CONTAINER_ITEMS:
            recv.items.extend(ext_items)
        else:
            recv.items.clear()
            recv.opaque = True
        return _NONE_VAL

    def _list_pop(self, recv: _ListVal, call: ast.Call, state: _ExecState, scope: ast.AST) -> _ProvVal:
        if not call.args and not recv.opaque and recv.items:
            return recv.items.pop()
        if call.args:
            idx = self._eval_int(call.args[0], state, scope)
            if not recv.opaque and idx is not None and -len(recv.items) <= idx < len(recv.items):
                return recv.items.pop(idx)
        recv.items.clear()
        recv.opaque = True
        return _FrameVal("unresolved") if recv.contains_frames else _OPAQUE_VAL

    def _eval_binary_frame_method(
        self,
        recv: _FrameVal,
        call: ast.Call,
        state: _ExecState,
        scope: ast.AST,
    ) -> _FrameVal:
        if any(isinstance(arg, ast.Starred) for arg in call.args):
            return _FrameVal("unresolved")
        args_map = _call_args_map(call, ("other",))
        other_expr = args_map.get("other")
        if other_expr is None:
            return _FrameVal("unresolved")
        other_val = self._eval_expr(other_expr, state, scope)
        for arg in call.args[1:]:
            self._eval_expr(arg, state, scope)
        for kw in call.keywords:
            if kw.arg != "other":
                self._eval_expr(kw.value, state, scope)
        return _FrameVal(merge_sides([recv.side, _as_required_frame_side(other_val)]))

    def _eval_glue_join_apply(self, call: ast.Call, state: _ExecState, scope: ast.AST) -> _FrameVal:
        if any(isinstance(arg, ast.Starred) for arg in call.args) or any(kw.arg is None for kw in call.keywords):
            return _FrameVal("unresolved")
        args_map = _call_args_map(call, ("frame1", "frame2"))
        f1_expr = args_map.get("frame1")
        f2_expr = args_map.get("frame2")
        if f1_expr is None or f2_expr is None:
            return _FrameVal("unresolved")
        s1 = _as_required_frame_side(self._eval_expr(f1_expr, state, scope))
        s2 = _as_required_frame_side(self._eval_expr(f2_expr, state, scope))
        return _FrameVal(merge_sides([s1, s2]))

    def _eval_reduce_call(self, call: ast.Call, state: _ExecState, scope: ast.AST) -> _ProvVal:
        if call.keywords or not (2 <= len(call.args) <= 3):
            return _FrameVal("unresolved")
        seq_val = self._eval_expr(call.args[1], state, scope)
        init_val = self._eval_expr(call.args[2], state, scope) if len(call.args) == 3 else None
        items: Sequence[_ProvVal] | None = None
        if isinstance(seq_val, _ListVal) and not seq_val.opaque:
            items = seq_val.items
        elif isinstance(seq_val, _TupleVal):
            items = seq_val.items
        if items is None or (not items and init_val is None):
            return _FrameVal("unresolved")
        sides: list[Side[ScriptRef]] = [_as_required_frame_side(item) for item in items]
        if init_val is not None:
            sides.append(_as_required_frame_side(init_val))
        return _FrameVal(merge_sides(sides))

    def _eval_general_transform_call(
        self,
        recv: _ProvVal | None,
        call: ast.Call,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal:
        passed: list[_ProvVal] = [
            self._eval_expr(arg.value if isinstance(arg, ast.Starred) else arg, state, scope) for arg in call.args
        ]
        passed.extend(self._eval_expr(kw.value, state, scope) for kw in call.keywords)
        arg_vals: list[_ProvVal] = [*([recv] if recv is not None else []), *passed]

        collected_sides: list[Side[ScriptRef]] = []
        saw_frame_carrier = False
        for v in arg_vals:
            if isinstance(v, _FrameVal):
                saw_frame_carrier = True
                collected_sides.append(v.side)
            elif isinstance(v, _ListVal) and _carries_frame(v):
                saw_frame_carrier = True
                if v.opaque or not v.items:
                    collected_sides.append("unresolved")
                else:
                    collected_sides.extend(_as_required_frame_side(item) for item in v.items)
            elif isinstance(v, _TupleVal) and _carries_frame(v):
                saw_frame_carrier = True
                collected_sides.extend(_as_required_frame_side(item) for item in v.items if _carries_frame(item))
            elif isinstance(v, _FrameDict) and _carries_frame(v):
                saw_frame_carrier = True
                if v.has_unknown_entries or not v.entries:
                    collected_sides.append("unresolved")
                else:
                    collected_sides.extend(_as_required_frame_side(item) for item in v.entries.values())

        # The result reflects the arguments as passed; an uninspectable callee may still have mutated them in
        # place, so invalidate after collecting. Runs wherever the call appears (statement, RHS, nested, return).
        self._mark_opaque_side_effect_call(call, recv, passed, state, scope)
        if saw_frame_carrier:
            return _FrameVal(merge_sides(collected_sides))
        dk = self._reader_for(state).dict_key(call)
        return _ScalarVal(dk) if not isinstance(dk, UnknownValue) else _OPAQUE_VAL

    def _mark_opaque_side_effect_call(
        self,
        call: ast.Call,
        recv: _ProvVal | None,
        passed: Sequence[_ProvVal],
        state: _ExecState,
        scope: ast.AST,
    ) -> None:
        if isinstance(call.func, ast.Attribute):
            if isinstance(call.func.value, ast.Name) and call.func.value.id in ("logger", "logging", "job"):
                return
            if isinstance(recv, (_FrameDict, _ListVal, _FrameVal)):
                return
        non_mutating = (
            isinstance(call.func, ast.Name)
            and call.func.id in _NON_MUTATING_BUILTINS
            and not self._bindings.has_binding_in_scope(scope, call.func.id)
        )
        arg_exprs = [
            *(a.value if isinstance(a, ast.Starred) else a for a in call.args),
            *(k.value for k in call.keywords),
        ]
        lambdas: list[ast.Lambda] = []
        for inner, val in zip(arg_exprs, passed, strict=True):
            if isinstance(inner, ast.Lambda):
                lambdas.append(inner)
                continue
            cb_fn = self._bindings.resolve_function_def(inner) if isinstance(inner, ast.Name) else None
            if cb_fn is not None:
                self._invalidate_function_effects(cb_fn, state)
                continue
            if non_mutating:
                continue
            # The evaluated value carries aliases reached through subscripts and containers; re-reading an access
            # path covers containers a later argument's helper call replaced in the state.
            _invalidate_reachable(val)
            if _is_access_path(inner):
                _invalidate_reachable(self._eval_expr(inner, state, scope))
        # A join replaces the state's containers. Invalidate arguments that still refer to the old state first.
        for callback in lambdas:
            self._run_lambda_effects(callback, state, scope)

    def _run_lambda_effects(self, fn: ast.Lambda, state: _ExecState, scope: ast.AST) -> None:
        # An unknown callee may save the callback without invoking it. Its I/O does not belong to this call site.
        probe = state.clone()
        self._suppress_io_depth += 1
        try:
            self._eval_expr(fn.body, probe, scope)
        finally:
            self._suppress_io_depth -= 1
        self._overwrite_state_in_place(state, _join_states(state, probe))

    def _invalidate_function_effects(
        self,
        fn_def: ast.FunctionDef | ast.AsyncFunctionDef,
        state: _ExecState,
    ) -> None:
        state.temp_views.clear()
        state.temp_views_opaque = True
        state.global_temp_views.clear()
        state.global_temp_views_opaque = True
        for node in ast.walk(fn_def):
            if isinstance(node, ast.Name) and not self._bindings.is_shadowed(node):
                owner = self._bindings.owner_of(self._bindings.scope_of(node), node.id)
                env = state.scope_envs.get(id(owner))
                if owner is fn_def or env is None:
                    continue
                if isinstance(node.ctx, ast.Load):
                    # Containers the function reaches through its closure can be mutated in place.
                    _invalidate_reachable(env.get(node.id))
                else:
                    env[node.id] = _FrameVal("unresolved")

    def _bail_helper_call(
        self,
        fn_def: ast.FunctionDef | ast.AsyncFunctionDef,
        call: ast.Call,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal:
        for arg in [*call.args, *(kw.value for kw in call.keywords)]:
            inner = arg.value if isinstance(arg, ast.Starred) else arg
            _invalidate_reachable(self._eval_expr(inner, state, scope))
        self._invalidate_function_effects(fn_def, state)
        return _FrameVal("unresolved")

    def _bind_helper_arguments(
        self,
        fn_def: ast.FunctionDef | ast.AsyncFunctionDef,
        call: ast.Call,
        state: _ExecState,
        scope: ast.AST,
    ) -> tuple[dict[str, _ProvVal], dict[str, object]] | None:
        positional_params = [*fn_def.args.posonlyargs, *fn_def.args.args]
        has_any_defaults = bool(fn_def.args.defaults) or any(d is not None for d in fn_def.args.kw_defaults)
        captured = state.fn_defaults.get(id(fn_def))
        if captured is None and has_any_defaults:
            return None

        caller_reader = self._reader_for(state)
        bound_prov: dict[str, _ProvVal] = {}
        bound_reader_vals: dict[str, object] = {}

        for p_name, (d_prov, d_reader_val) in (captured or {}).items():
            bound_prov[p_name] = d_prov
            bound_reader_vals[p_name] = d_reader_val

        for param, arg_expr in zip(positional_params, call.args, strict=False):
            bound_prov[param.arg] = self._eval_expr(arg_expr, state, scope)
            bound_reader_vals[param.arg] = caller_reader.eval_for_override(arg_expr)

        all_params = (*positional_params, *fn_def.args.kwonlyargs)
        all_param_names = {p.arg for p in all_params}
        for kw in call.keywords:
            if kw.arg is None or kw.arg not in all_param_names:
                return None
            bound_prov[kw.arg] = self._eval_expr(kw.value, state, scope)
            bound_reader_vals[kw.arg] = caller_reader.eval_for_override(kw.value)

        if any(p.arg not in bound_prov for p in all_params):
            return None
        return bound_prov, bound_reader_vals

    def _invoke_helper_function(
        self,
        fn_def: ast.FunctionDef | ast.AsyncFunctionDef,
        call: ast.Call,
        state: _ExecState,
        scope: ast.AST,
    ) -> _ProvVal:
        positional_params = [*fn_def.args.posonlyargs, *fn_def.args.args]
        if (
            len(self._call_stack) >= MAX_CALL_DEPTH
            or fn_def in self._call_stack
            or fn_def.args.vararg
            or fn_def.args.kwarg
            or len(call.args) > len(positional_params)
            or any(isinstance(a, ast.Starred) for a in call.args)
            or any(kw.arg is None for kw in call.keywords)
        ):
            return self._bail_helper_call(fn_def, call, state, scope)

        bound = self._bind_helper_arguments(fn_def, call, state, scope)
        if bound is None:
            return _FrameVal("unresolved")
        bound_prov, bound_reader_vals = bound

        prev_fn_env = state.scope_envs.get(id(fn_def))
        prev_fn_overrides = {k: v for k, v in state.scope_overrides.items() if k[0] is fn_def}
        for k in prev_fn_overrides:
            state.scope_overrides.pop(k, None)

        state.scope_envs[id(fn_def)] = dict(bound_prov)
        for p_name, r_val in bound_reader_vals.items():
            state.scope_overrides[(fn_def, p_name)] = r_val

        self._call_stack.append(fn_def)
        try:
            return_outcomes: list[tuple[_ExecState, _ProvVal]] = []
            end_status = self._exec_block(fn_def.body, state, fn_def, return_outcomes=return_outcomes)
            if end_status == "normal":
                return_outcomes.append(state.clone_with_val(_NONE_VAL))
            if not return_outcomes:
                return _NONE_VAL
            merged_state, merged_ret = return_outcomes[0]
            for extra_state, extra_ret in return_outcomes[1:]:
                pair_memo: dict[tuple[int, int], _ProvVal] = {}
                merged_state = _join_states(merged_state, extra_state, pair_memo=pair_memo)
                merged_ret = _join_prov(merged_ret, extra_ret, pair_memo=pair_memo)
                _invalidate_ambiguous_aliases(pair_memo)
            return self._overwrite_state_in_place(state, merged_state, merged_ret)
        finally:
            self._call_stack.pop()
            for k in [key for key in state.scope_overrides if key[0] is fn_def]:
                state.scope_overrides.pop(k, None)
            state.scope_overrides.update(prev_fn_overrides)
            if prev_fn_env is not None:
                state.scope_envs[id(fn_def)] = prev_fn_env
            else:
                state.scope_envs.pop(id(fn_def), None)


def _analyze_script_provenance(
    parsed: ParsedScript,
    context: ParameterContext | None,
    execution_id: str,
) -> list[LineageGroup[ScriptRef]]:
    return _ProvenanceAnalyzer(parsed, context=context, execution_id=execution_id).analyze()


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
    if conn_opts.opaque:
        return []
    found: list[str] = []
    for key in ("paths", "path"):
        if key not in conn_opts.entries:
            continue
        raw = conn_opts.entries[key]
        if isinstance(raw, UnknownValue):
            return []
        if isinstance(raw, str):
            if _is_s3_uri(raw):
                found.append(raw)
        elif hasattr(raw, "items") and isinstance(getattr(raw, "items", None), tuple):
            for item in raw.items:  # type: ignore[union-attr]
                s = reader.scalar_to_str(item)
                if isinstance(s, UnknownValue):
                    return []
                if _is_s3_uri(s):
                    found.append(s)
        else:
            return []
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
        if reader.has_unresolved_string_item(arg):
            return []
        candidates.extend(reader.string_list(arg))
    for kw in call.keywords:
        if kw.arg in ("path", "paths"):
            if reader.has_unresolved_string_item(kw.value):
                return []
            candidates.extend(reader.string_list(kw.value))
    opt_path = options_map.get("path")
    if isinstance(opt_path, UnknownValue):
        return []
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
