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
Shared Python AST bindings, parameter-contextual expression evaluation,
execution-slice expansion, and typed lineage-group primitives for AWS Glue scripts.
"""

import ast
import re
import string
from collections.abc import Callable, Iterable, Iterator, Mapping
from dataclasses import dataclass, replace
from functools import cached_property
from typing import Generic, Literal, TypeAlias, TypeVar

from cachetools import LRUCache

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

T = TypeVar("T")
ScalarValue: TypeAlias = str | int | float | bool
DictKey: TypeAlias = ScalarValue | None | tuple["DictKey", ...]

SPARK_TERMINAL_PARAMETERS = {"path", "format", "schema", "mode", "partitionBy"}
GLUE_IO_FLAT_METHODS = {
    "create_dynamic_frame_from_options",
    "write_dynamic_frame_from_options",
    "create_dynamic_frame_from_catalog",
    "write_dynamic_frame_from_catalog",
    "write_dynamic_frame_from_jdbc_conf",
    "purge_table",
}
SPARK_READ_TERMINALS = {"load", "table", "jdbc", "json", "parquet", "csv", "orc", "avro", "text"}
SPARK_WRITE_TERMINALS = {"save", "saveAsTable", "insertInto", "jdbc", "json", "parquet", "csv", "orc", "avro", "text"}

PERCENT_NAMED_FIELD_PATTERN = re.compile(r"%\(([^)]+)\)[-#0 +]*\d*(?:\.\d+)?[diouxXeEfFgGcrsa]")
PERCENT_HUGE_WIDTH_PATTERN = re.compile(r"%(?:\([^)]*\))?[-#0 +]*\d{4,}")
# [[fill]align][sign][z][#][0][width][grouping][.precision][type]
FORMAT_SPEC_PATTERN = re.compile(
    r"^(?:(.)?([<>=^]))?([+\- ])?(z)?(#)?(0)?(?P<width>\d*)([,_])?(?:\.(?P<precision>\d*))?([a-zA-Z%]?)$"
)
PERCENT_CONVERSION_PATTERN = re.compile(
    r"%(?:\((?P<name>[^)]*)\))?[-#0 +]*(?P<width>\d+|\*)?(?:\.(?P<precision>\d+|\*))?[hlL]?(?P<conv>[diouxXeEfFgGcrsa%])"
)

FUNCTIONS = (ast.FunctionDef, ast.AsyncFunctionDef)
COMPREHENSIONS = (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
SHADOWING_NODES = (ast.Lambda, ast.ClassDef, *COMPREHENSIONS)
LOOPS = (ast.For, ast.AsyncFor, ast.While)
KEYED_METHODS = {"pop", "setdefault", "__setitem__", "__delitem__"}
MUTATING_METHODS = {"update", "popitem", "clear", *KEYED_METHODS}

# ADR:2026-10-22-glue-snowflake-refs-with-unknown-schema-link-only-unique-tables
MAX_CANDIDATES = 16
# ADR:2026-11-13-glue-parameterized-lineage-evaluates-per-run-context
MAX_EXPR_DEPTH = 32
MAX_STRING_LENGTH = 4096
MAX_LOOP_UNROLLS = 32
MEMO_SIZE = 1024
PARSED_AST_CACHE_SIZE = 64

LIST_MUTATING_METHODS = {"append", "extend", "insert", "pop", "remove", "clear", "sort", "reverse", "__setitem__"}
RESOLVED_OPTIONS_BUILTINS = (
    "job-bookmark-option",
    "job-bookmark-from",
    "job-bookmark-to",
    "JOB_ID",
    "JOB_RUN_ID",
    "SECURITY_CONFIGURATION",
    "encryption-type",
    "enable-data-lineage",
    "TempDir",
    "RedshiftTempDir",
)


class UnknownValue:
    """A value that is set in the script but cannot be determined statically."""

    def __repr__(self) -> str:
        return "UNKNOWN"


UNKNOWN = UnknownValue()
ABSENT = object()
# An expansion whose keys cannot be listed (**get_options()) and may set any key.
OPAQUE = object()
_SEQUENCE_MUTATION = object()
# Non-string token bound to WORKFLOW_RUN_ID on default-only workflow fallback contexts so
# `get_workflow_run_properties(Name=args["WORKFLOW_NAME"], RunId=args["WORKFLOW_RUN_ID"])`
# matches the workflow's default run context without fabricating a string run ID in table names.
_CURRENT_WORKFLOW_RUN = object()


@dataclass(frozen=True)
class Resolved(Generic[T]):
    """Non-empty tuple of resolved lineage references on one side of a dependency group."""

    refs: tuple[T, ...]

    def __post_init__(self) -> None:
        if not self.refs:
            raise ValueError("Resolved.refs must be non-empty")


Side: TypeAlias = Resolved[T] | Literal["absent", "unresolved"]


@dataclass(frozen=True)
class LineageGroup(Generic[T]):
    """Correlated `(sources, targets)` dependency unit within one execution context."""

    execution_id: str
    dependency_id: str
    sources: Side[T]
    targets: Side[T]


def side_from_refs(refs: Iterable[T], *, declared: bool) -> Side[T]:
    unique = tuple(dict.fromkeys(refs))
    if unique:
        return Resolved(unique)
    return "unresolved" if declared else "absent"


def merge_sides(sides: Iterable[Side[T]]) -> Side[T]:
    collected: list[T] = []
    seen: set[T] = set()
    for side in sides:
        if side == "absent":
            continue
        if side == "unresolved":
            return "unresolved"
        for ref in side.refs:
            if ref not in seen:
                seen.add(ref)
                collected.append(ref)
    return Resolved(tuple(collected)) if collected else "absent"


@dataclass(frozen=True)
class ParameterContext:
    """Typed Glue execution context carrying run identity, job arguments, and workflow run properties."""

    job_args: tuple[tuple[str, str], ...] = ()
    run_props: tuple[tuple[str, str], ...] = ()
    run_props_opaque: bool = False
    workflow_name: str | None = None
    workflow_run_id: str | None = None
    job_run_id: str | None = None
    execution_id: str = "default"
    has_default_workflow_run: bool = False

    @classmethod
    def from_mappings(
        cls,
        job_args: Mapping[str, str] | None = None,
        run_props: Mapping[str, str] | None = None,
        run_props_opaque: bool = False,
        *,
        workflow_name: str | None = None,
        workflow_run_id: str | None = None,
        job_run_id: str | None = None,
        execution_id: str | None = None,
        has_default_workflow_run: bool = False,
    ) -> "ParameterContext":
        cleaned_args = {str(k): str(v) for k, v in (job_args or {}).items() if k is not None and v is not None}
        cleaned_props = {str(k): str(v) for k, v in (run_props or {}).items() if k is not None and v is not None}
        resolved_wf_name = (
            workflow_name or cleaned_args.get("--WORKFLOW_NAME") or cleaned_args.get("WORKFLOW_NAME") or None
        )
        resolved_wf_run_id = (
            workflow_run_id or cleaned_args.get("--WORKFLOW_RUN_ID") or cleaned_args.get("WORKFLOW_RUN_ID") or None
        )
        resolved_jr_id = job_run_id or cleaned_args.get("--JOB_RUN_ID") or None
        if execution_id is None:
            parts = [
                part
                for part in (
                    f"wf:{resolved_wf_name}" if resolved_wf_name else None,
                    f"wfrun:{resolved_wf_run_id}" if resolved_wf_run_id else None,
                    "wfrun:default" if has_default_workflow_run and not resolved_wf_run_id else None,
                    f"jr:{resolved_jr_id}" if resolved_jr_id else None,
                )
                if part
            ]
            execution_id = "|".join(parts) if parts else "default"
        return cls(
            job_args=tuple(sorted(cleaned_args.items())),
            run_props=tuple(sorted(cleaned_props.items())),
            run_props_opaque=run_props_opaque,
            workflow_name=resolved_wf_name,
            workflow_run_id=resolved_wf_run_id,
            job_run_id=resolved_jr_id,
            execution_id=execution_id,
            has_default_workflow_run=has_default_workflow_run,
        )

    def dedup_key(self) -> tuple[object, ...]:
        """Identity key for deduplicating equivalent parameter evaluations within a job."""
        return (
            self.job_args,
            self.run_props,
            self.run_props_opaque,
            self.workflow_name,
            self.workflow_run_id,
            self.has_default_workflow_run,
        )


@dataclass
class DictValue:
    entries: dict[DictKey, object]
    opaque: bool = False


@dataclass(frozen=True)
class _TupleValue:
    items: tuple[object, ...]


@dataclass(frozen=True)
class _ListValue:
    items: tuple[object, ...]


def _is_deeply_immutable(value: object) -> bool:
    if isinstance(value, (str, int, float, bool)):
        return True
    if isinstance(value, _TupleValue):
        return all(_is_deeply_immutable(item) for item in value.items)
    return False


def _digits_exceed_max_string_length(digits: str) -> bool:
    stripped = digits.lstrip("0")
    if not stripped:
        return False
    if len(stripped) > len(str(MAX_STRING_LENGTH)):
        return True
    return int(stripped) > MAX_STRING_LENGTH


def _format_spec_exceeds_bounds(spec: str) -> bool:
    if "{" in spec or "}" in spec:
        return True
    match = FORMAT_SPEC_PATTERN.match(spec)
    if match is None:
        return True
    width = match.group("width")
    if width and _digits_exceed_max_string_length(width):
        return True
    precision = match.group("precision")
    return bool(precision) and _digits_exceed_max_string_length(precision)


def _percent_template_exceeds_bounds(template: str) -> bool:
    for match in PERCENT_CONVERSION_PATTERN.finditer(template):
        if match.group("conv") == "%":
            continue
        for digits in (match.group("width"), match.group("precision")):
            if digits and digits != "*" and _digits_exceed_max_string_length(digits):
                return True
    return False


def _percent_star_exceeds_bounds(template: str, values: Iterable[object]) -> bool:
    if "*" not in template:
        return False
    return any(isinstance(v, int) and not isinstance(v, bool) and abs(v) > MAX_STRING_LENGTH for v in values)


@dataclass(frozen=True)
class _Binding:
    statement: ast.AST
    value: ast.expr | None
    is_remote: bool = False


@dataclass
class BindingResolution:
    values: list[ast.expr]
    changes: list[tuple[object, object]]


class ScriptBindings:
    """Module-level and function-local bindings and reaching-definition queries over a Python AST."""

    def __init__(self, tree: ast.Module):
        self._parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
        self._blocks: dict[ast.AST, tuple[ast.AST, str]] = {
            statement: (node, field)
            for node in ast.walk(tree)
            for field, value in ast.iter_fields(node)
            if isinstance(value, list)
            for statement in value
            if isinstance(statement, ast.stmt)
        }
        self._module = tree
        self._declared: dict[tuple[ast.AST, str], type] = {}
        self._bindings: dict[tuple[ast.AST, str], list[_Binding]] = {}
        self._shadows: dict[ast.AST, set[str]] = {}
        self._changes: dict[tuple[ast.AST, str], list[tuple[object, object]]] = {}
        self._nonlocal_bindings: list[tuple[ast.AST, str, _Binding]] = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.Global, ast.Nonlocal)):
                scope = self.scope_of(node)
                self._declared.update({(scope, name): type(node) for name in node.names})
        for node in ast.walk(tree):
            self._index(node)
        for function, name, binding in self._nonlocal_bindings:
            self._bindings.setdefault((self.owner_of(self.scope_of(function), name), name), []).append(binding)
        for node in ast.walk(tree):
            self._index_change(node)
        self._carry_changes_to_aliases()

    @property
    def module(self) -> ast.Module:
        return self._module

    def parent_of(self, node: ast.AST) -> ast.AST | None:
        return self._parents.get(node)

    def _index(self, node: ast.AST) -> None:
        if isinstance(node, ast.Name) and not isinstance(node.ctx, ast.Load):
            self._index_store(node)
        elif isinstance(node, ast.arg):
            self._bind(node.arg, _Binding(node, None), self._container_of(node))
        elif isinstance(node, (*FUNCTIONS, ast.ClassDef)):
            self._bind(node.name, _Binding(node, None), self._container_of(node))
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                if alias.name != "*":
                    self._bind(alias.asname or alias.name.split(".")[0], _Binding(node, None), self._container_of(node))
        elif isinstance(node, (ast.ExceptHandler, ast.MatchAs, ast.MatchStar)) and node.name:
            self._bind(node.name, _Binding(node, None), self._container_of(node))
        elif isinstance(node, ast.MatchMapping) and node.rest:
            self._bind(node.rest, _Binding(node, None), self._container_of(node))
        elif isinstance(node, ast.AnnAssign) and node.value is None and isinstance(node.target, ast.Name):
            container = self._container_of(node)
            if isinstance(container, FUNCTIONS):
                self._bindings.setdefault((container, node.target.id), [])

    def _index_store(self, node: ast.Name) -> None:
        parent = self._parents[node]
        if isinstance(parent, ast.AnnAssign) and parent.value is None:
            return
        if isinstance(parent, ast.AugAssign) and isinstance(parent.op, ast.BitOr):
            return
        statement = self.statement_of(node)
        value = None
        if isinstance(parent, ast.Assign) and node in parent.targets:
            value = parent.value
        elif isinstance(parent, ast.AnnAssign) and node is parent.target:
            value = parent.value
        container = self._container_of(node)
        while isinstance(parent, ast.NamedExpr) and isinstance(container, COMPREHENSIONS):
            container = self._container_of(container)
        self._bind(node.id, _Binding(statement, value), container)

    def _bind(self, name: str, binding: _Binding, container: ast.AST) -> None:
        if isinstance(container, SHADOWING_NODES):
            self._shadows.setdefault(container, set()).add(name)
            return
        declared = self._declared.get((container, name))
        if declared is ast.Nonlocal:
            self._nonlocal_bindings.append((container, name, replace(binding, is_remote=True)))
            return
        if declared is ast.Global:
            container, binding = self._module, replace(binding, is_remote=container is not self._module)
        self._bindings.setdefault((container, name), []).append(binding)

    def _carry_changes_to_aliases(self) -> None:
        aliases = [
            (owner, name, binding.value)
            for (owner, name), bindings in self._bindings.items()
            for binding in bindings
            if isinstance(binding.value, ast.Name) and not self.is_shadowed(binding.value)
        ]
        for _ in aliases:
            carried = False
            for owner, name, source in aliases:
                changes = self._changes.get((owner, name), [])
                target = self._changes.setdefault((self.owner_of(self.scope_of(source), source.id), source.id), [])
                new = [change for change in changes if change not in target]
                target.extend(new)
                carried = carried or bool(new)
            if not carried:
                break

    def _index_change(self, node: ast.AST) -> None:
        unknown_key = OPAQUE
        if isinstance(node, ast.Subscript) and not isinstance(node.ctx, ast.Load):
            target, keys = node.value, [node.slice]
        elif isinstance(node, ast.AugAssign) and isinstance(node.op, ast.BitOr):
            target, keys = node.target, _changed_keys(node.value)
        elif isinstance(node, ast.AugAssign) and isinstance(node.op, (ast.Add, ast.Mult)):
            target, keys = node.target, [None]
            unknown_key = _SEQUENCE_MUTATION
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and (node.func.attr in MUTATING_METHODS or node.func.attr in LIST_MUTATING_METHODS)
        ):
            target, keys = node.func.value, _method_changed_keys(node)
        else:
            return
        if isinstance(target, ast.Name) and not self.is_shadowed(target):
            owner = self.owner_of(self.scope_of(target), target.id)
            self._changes.setdefault((owner, target.id), []).extend(
                (lit_key, UNKNOWN)
                if (lit_key := _literal_dict_key(key)) is not _UNREADABLE_KEY
                else (unknown_key, None)
                for key in keys
            )

    def _container_of(self, node: ast.AST) -> ast.AST:
        previous, child, parent = None, node, self._parents.get(node)
        while parent is not None:
            if isinstance(parent, (*FUNCTIONS, ast.ClassDef)) and child in parent.body:
                return parent
            if isinstance(parent, ast.Lambda) and child is parent.body:
                return parent
            if isinstance(parent, ast.arguments) and isinstance(child, ast.arg):
                return self._parents[parent]
            if isinstance(parent, ast.comprehension) and child is parent.target:
                return self._parents[parent]
            if isinstance(parent, COMPREHENSIONS):
                first = parent.generators[0]
                if not (child is first and previous is first.iter):
                    return parent
            previous, child, parent = child, parent, self._parents.get(parent)
        return self._module

    def scope_of(self, node: ast.AST) -> ast.AST:
        container = self._container_of(node)
        while isinstance(container, SHADOWING_NODES):
            container = self._container_of(container)
        return container

    def _shadowing_containers(self, name: ast.Name) -> list[ast.AST]:
        containers, container = [], self._container_of(name)
        while isinstance(container, SHADOWING_NODES):
            containers.append(container)
            container = self._container_of(container)
        return containers

    def is_shadowed(self, name: ast.Name) -> bool:
        return any(name.id in self._shadows.get(container, ()) for container in self._shadowing_containers(name))

    def has_binding_in_scope(self, scope: ast.AST, name: str) -> bool:
        owner = self.owner_of(scope, name)
        return bool(self._bindings.get((owner, name)))

    def resolve_function_def(self, func_expr: ast.expr) -> ast.FunctionDef | ast.AsyncFunctionDef | None:
        if not isinstance(func_expr, ast.Name) or self.is_shadowed(func_expr):
            return None
        scope = self.scope_of(func_expr)
        owner = self.owner_of(scope, func_expr.id)
        bindings = self._bindings.get((owner, func_expr.id), [])
        if len(bindings) == 1 and isinstance(bindings[0].statement, FUNCTIONS):
            return bindings[0].statement
        return None

    def owner_of(self, scope: ast.AST, name: str) -> ast.AST:
        declared = self._declared.get((scope, name))
        while scope is not self._module and declared is not ast.Global:
            if (scope, name) in self._bindings and declared is not ast.Nonlocal:
                return scope
            scope = self.scope_of(scope)
            declared = self._declared.get((scope, name))
        return self._module

    def resolve(self, name: ast.Name) -> BindingResolution | None:
        if self.is_shadowed(name):
            return None
        scope = self.scope_of(name)
        owner = self.owner_of(scope, name.id)
        bindings = self._bindings.get((owner, name.id), [])
        is_deferred = any(isinstance(c, (ast.Lambda, ast.GeneratorExp)) for c in self._shadowing_containers(name))
        candidates = self._reaching(name, bindings) if owner is scope and not is_deferred else bindings
        values = [binding.value for binding in candidates if binding.value is not None]
        if not values or len(values) != len(candidates) or len(values) > MAX_CANDIDATES:
            return None
        return BindingResolution(values, self._changes.get((owner, name.id), []))

    def reaching_loop_statement(self, name: ast.Name) -> ast.For | None:
        if self.is_shadowed(name):
            return None
        scope = self.scope_of(name)
        owner = self.owner_of(scope, name.id)
        if owner is not scope or self._changes.get((owner, name.id)):
            return None
        if any(isinstance(c, (ast.Lambda, ast.GeneratorExp)) for c in self._shadowing_containers(name)):
            return None
        candidates = self._reaching(name, self._bindings.get((owner, name.id), []))
        if len(candidates) != 1 or candidates[0].value is not None:
            return None
        stmt = candidates[0].statement
        if (
            isinstance(stmt, ast.For)
            and isinstance(stmt.target, ast.Name)
            and stmt.target.id == name.id
            and (stmt in self._ancestors(self.statement_of(name)) or self.statement_of(name) in stmt.body)
        ):
            return stmt
        return None

    def enclosing_for_loops(self, node: ast.AST) -> list[ast.For]:
        loops: list[ast.For] = []
        child, parent = node, self._parents.get(node)
        while parent is not None:
            if isinstance(parent, ast.For) and child is not parent.iter and child is not parent.target:
                loops.append(parent)
            child, parent = parent, self._parents.get(parent)
        loops.reverse()
        return loops

    def _reaching(self, name: ast.Name, bindings: list[_Binding]) -> list[_Binding]:
        remote = [binding for binding in bindings if binding.is_remote]
        bindings = [binding for binding in bindings if not binding.is_remote]
        read_at = self.statement_of(name)
        enclosing = self._enclosing_blocks(read_at)
        before = sorted((b for b in bindings if node_position(b.statement) < node_position(read_at)), key=_binding_pos)
        latest = next(
            (b for b in reversed(before) if self._blocks.get(self.statement_of(b.statement)) in enclosing), None
        )
        candidates = [
            b for b in before if latest is None or node_position(b.statement) >= node_position(latest.statement)
        ]
        loops = [node for node in self._ancestors(read_at) if isinstance(node, LOOPS)]
        candidates += [
            b
            for b in bindings
            if node_position(b.statement) >= node_position(read_at)
            and any(loop in self._ancestors(b.statement) for loop in loops)
        ]
        return candidates + remote

    def statement_of(self, node: ast.AST) -> ast.AST:
        while not isinstance(node, ast.stmt) and node in self._parents:
            node = self._parents[node]
        return node

    def _ancestors(self, node: ast.AST) -> list[ast.AST]:
        ancestors = []
        parent = self._parents.get(node)
        while parent is not None and not isinstance(parent, (*FUNCTIONS, ast.Module)):
            ancestors.append(parent)
            parent = self._parents.get(parent)
        return ancestors

    def _enclosing_blocks(self, statement: ast.AST) -> set[tuple[ast.AST, str]]:
        blocks: set[tuple[ast.AST, str]] = set()
        while statement in self._blocks:
            block = self._blocks[statement]
            blocks.add(block)
            if isinstance(block[0], (*FUNCTIONS, ast.Module)):
                break
            statement = self.statement_of(block[0])
        return blocks


def node_position(node: ast.AST) -> tuple[int, int]:
    return getattr(node, "lineno", 0), getattr(node, "col_offset", 0)


def _binding_pos(binding: _Binding) -> tuple[int, int]:
    return node_position(binding.statement)


_UNREADABLE_KEY = object()


def literal_str(node: ast.expr | None) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def _literal_dict_key(node: ast.expr | None) -> object:
    if node is None:
        return _UNREADABLE_KEY
    if isinstance(node, ast.Constant):
        if node.value is None:
            return None
        if isinstance(node.value, str):
            return node.value if len(node.value) <= MAX_STRING_LENGTH else _UNREADABLE_KEY
        if isinstance(node.value, (int, float, bool)):
            return node.value
        return _UNREADABLE_KEY
    if isinstance(node, ast.Tuple) and len(node.elts) <= MAX_CANDIDATES * 4:
        parts: list[DictKey] = []
        for elt in node.elts:
            part = _literal_dict_key(elt)
            if part is _UNREADABLE_KEY:
                return _UNREADABLE_KEY
            parts.append(part)  # type: ignore[arg-type]
        return tuple(parts)
    return _UNREADABLE_KEY


def literal_key_value_pairs(tree: ast.Module) -> Iterator[tuple[str | None, str | None]]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values, strict=True):
                yield literal_str(key), literal_str(value)
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute) and node.func.attr == "option" and len(node.args) == 2:
                yield literal_str(node.args[0]), literal_str(node.args[1])
            for keyword in node.keywords:
                yield keyword.arg, literal_str(keyword.value)


def _changed_keys(node: ast.expr | None) -> list[ast.expr | None]:
    if isinstance(node, ast.Dict) and all(key is not None for key in node.keys):
        return list(node.keys)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "dict" and not node.args:
        return [ast.Constant(keyword.arg) if keyword.arg else None for keyword in node.keywords]
    return [None]


def _method_changed_keys(call: ast.Call) -> list[ast.expr | None]:
    method = call.func.attr if isinstance(call.func, ast.Attribute) else None
    if method in KEYED_METHODS:
        return [call.args[0] if call.args else None]
    if method == "update":
        keys = [key for arg in call.args for key in _changed_keys(arg)]
        return keys + [ast.Constant(keyword.arg) if keyword.arg else None for keyword in call.keywords]
    return [None]


def _callee_name(func: ast.expr) -> str | None:
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def _is_sys_argv(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Attribute)
        and node.attr == "argv"
        and isinstance(node.value, ast.Name)
        and node.value.id == "sys"
    )


def _changes_sys_argv(tree: ast.Module) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, (ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Delete)):
            targets = node.targets if isinstance(node, (ast.Assign, ast.Delete)) else [node.target]
            if any(_is_sys_argv(sub) for target in targets for sub in ast.walk(target)):
                return True
            if isinstance(node, ast.Assign) and _is_sys_argv(node.value):
                return True
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in LIST_MUTATING_METHODS
            and _is_sys_argv(node.func.value)
        ):
            return True
    return False


def _apply_dict_changes(base: DictValue, changes: list[tuple[object, object]]) -> DictValue:
    entries = dict(base.entries)
    opaque = base.opaque
    for key, val in changes:
        if key is OPAQUE or key is _SEQUENCE_MUTATION:
            entries.clear()
            opaque = True
        else:
            entries.pop(key, None)  # type: ignore[arg-type]
            entries[key] = val  # type: ignore[index]
    return DictValue(entries=entries, opaque=opaque)


def _values_equal(left: object, right: object) -> bool:
    if left is UNKNOWN or right is UNKNOWN or left is ABSENT or right is ABSENT:
        return False
    if left is _CURRENT_WORKFLOW_RUN or right is _CURRENT_WORKFLOW_RUN:
        return left is right
    if type(left) is not type(right):
        return False
    if isinstance(left, DictValue) and isinstance(right, DictValue):
        if left.opaque != right.opaque or set(left.entries) != set(right.entries):
            return False
        return all(_values_equal(left.entries[k], right.entries[k]) for k in left.entries)
    if isinstance(left, _TupleValue) and isinstance(right, _TupleValue):
        return len(left.items) == len(right.items) and all(
            _values_equal(a, b) for a, b in zip(left.items, right.items, strict=True)
        )
    if isinstance(left, _ListValue) and isinstance(right, _ListValue):
        return len(left.items) == len(right.items) and all(
            _values_equal(a, b) for a, b in zip(left.items, right.items, strict=True)
        )
    return left == right


def _merge_dict_values(candidates: list[DictValue]) -> DictValue:
    if len(candidates) == 1:
        return DictValue(entries=dict(candidates[0].entries), opaque=candidates[0].opaque)
    keys: list[DictKey] = []
    seen_keys: set[DictKey] = set()
    for cand in candidates:
        for key in cand.entries:
            if key not in seen_keys:
                seen_keys.add(key)
                keys.append(key)
    merged: dict[DictKey, object] = {}
    for key in keys:
        first = candidates[0].entries.get(key, UNKNOWN if candidates[0].opaque else ABSENT)
        agreed = first not in (UNKNOWN, ABSENT) and all(
            _values_equal(first, cand.entries.get(key, UNKNOWN if cand.opaque else ABSENT)) for cand in candidates[1:]
        )
        merged[key] = first if agreed else UNKNOWN
    return DictValue(entries=merged, opaque=any(cand.opaque for cand in candidates))


def _apply_settings_for_merge(settings: list[tuple[object, object]]) -> tuple[dict[str, object], bool]:
    entries: dict[str, object] = {}
    opaque = False
    for key, val in settings:
        if key is OPAQUE:
            entries.clear()
            opaque = True
        elif isinstance(key, str):
            entries[key] = val
    return entries, opaque


def _merge_settings(alternatives: list[list[tuple[object, object]]]) -> list[tuple[object, object]]:
    if len(alternatives) == 1:
        return list(alternatives[0])
    applied = [_apply_settings_for_merge(alt) for alt in alternatives]
    any_opaque = any(op for _, op in applied)
    keys = sorted({k for ent, _ in applied for k in ent})
    out: list[tuple[object, object]] = [(OPAQUE, None)] if any_opaque else []
    for key in keys:
        first = applied[0][0].get(key, UNKNOWN if applied[0][1] else ABSENT)
        agreed = first not in (UNKNOWN, ABSENT) and all(
            _values_equal(first, ent.get(key, UNKNOWN if op else ABSENT)) for ent, op in applied[1:]
        )
        out.append((key, first if agreed else UNKNOWN))
    return out


class ScriptReader:
    """Evaluates static and parameter-contextual expressions over a parsed Python script."""

    def __init__(
        self,
        tree: ast.Module,
        context: ParameterContext | None = None,
        bindings: ScriptBindings | None = None,
        loop_overrides: Mapping[ast.For, ScalarValue] | None = None,
        scope_overrides: Mapping[tuple[ast.AST, str], object] | None = None,
    ):
        self._tree = tree
        self._context = context
        self._shared_bindings = bindings
        self._loop_overrides: Mapping[ast.For, ScalarValue] = loop_overrides or {}
        self._scope_overrides: Mapping[tuple[ast.AST, str], object] = scope_overrides or {}
        self._values: LRUCache[ast.Name, object] = LRUCache(maxsize=MEMO_SIZE)
        self._settings: LRUCache[ast.Name, list[tuple[object, object]]] = LRUCache(maxsize=MEMO_SIZE)
        self._resolving: set[ast.Name] = set()
        self._depth = 0

    def with_overrides(
        self,
        *,
        loop_overrides: Mapping[ast.For, ScalarValue] | None = None,
        scope_overrides: Mapping[tuple[ast.AST, str], object] | None = None,
    ) -> "ScriptReader":
        return ScriptReader(
            self._tree,
            context=self._context,
            bindings=self.bindings,
            loop_overrides=self._loop_overrides if loop_overrides is None else loop_overrides,
            scope_overrides=self._scope_overrides if scope_overrides is None else scope_overrides,
        )

    @cached_property
    def _sys_argv_changed(self) -> bool:
        return _changes_sys_argv(self._tree)

    @property
    def bindings(self) -> ScriptBindings:
        if self._shared_bindings is None:
            self._shared_bindings = ScriptBindings(self._tree)
        return self._shared_bindings

    def string(self, node: ast.expr | None) -> str | UnknownValue:
        return self.scalar_to_str(self._eval(node))

    def int_value(self, node: ast.expr | None) -> int | None:
        val = self._eval(node)
        return val if isinstance(val, int) and not isinstance(val, bool) else None

    def dict_key(self, node: ast.expr | None) -> DictKey | UnknownValue:
        if node is None:
            return UNKNOWN
        if isinstance(node, ast.Constant) and node.value is None:
            return None
        return self._value_to_dict_key(self._eval(node))

    @classmethod
    def _value_to_dict_key(cls, val: object) -> DictKey | UnknownValue:
        if val is None:
            return None
        if isinstance(val, str):
            return val if len(val) <= MAX_STRING_LENGTH else UNKNOWN
        if isinstance(val, (int, float, bool)):
            return val
        if isinstance(val, _TupleValue):
            parts: list[DictKey] = []
            for item in val.items:
                converted = cls._value_to_dict_key(item)
                if isinstance(converted, UnknownValue):
                    return UNKNOWN
                parts.append(converted)
            return tuple(parts)
        return UNKNOWN

    def eval_for_override(self, node: ast.expr | None) -> object:
        return self._eval(node)

    def has_unresolved_string_item(self, node: ast.expr | None) -> bool:
        if node is None:
            return False
        val = self._eval(node)
        if isinstance(val, UnknownValue):
            return True
        if isinstance(val, str):
            return False
        if isinstance(val, (_TupleValue, _ListValue)):
            return any(not isinstance(self.scalar_to_str(item), str) for item in val.items)
        return True

    def string_list(self, node: ast.expr | None) -> list[str]:
        val = self._eval(node)
        if isinstance(val, str):
            return [val]
        if isinstance(val, (_TupleValue, _ListValue)):
            out: list[str] = []
            for item in val.items:
                s = self.scalar_to_str(item)
                if isinstance(s, str):
                    out.append(s)
            return out
        return []

    def sequence(self, node: ast.expr | None, *, allow_empty_range: bool = False) -> list[ScalarValue] | None:
        """Bounded constant/derived sequence elements preserving scalar types, or None if unknown."""
        if node is None:
            return None
        if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
            if not (1 <= len(node.elts) <= MAX_LOOP_UNROLLS):
                return None
            return self._validated_scalars([self._eval(elt) for elt in node.elts])
        if isinstance(node, ast.Name):
            return self._sequence_from_value(self._eval(node))
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute) and not node.keywords:
                return self._sequence_from_attr_call(node, node.func)
            if isinstance(node.func, ast.Name) and node.func.id == "range" and not node.keywords:
                return self._sequence_from_range(node, allow_empty=allow_empty_range)
        return None

    @classmethod
    def _validated_scalars(cls, raw_items: Iterable[object]) -> list[ScalarValue] | None:
        out: list[ScalarValue] = []
        for item in raw_items:
            if not isinstance(item, (str, int, float, bool)) or isinstance(cls.scalar_to_str(item), UnknownValue):
                return None
            out.append(item)
        return out if 1 <= len(out) <= MAX_LOOP_UNROLLS else None

    def _sequence_from_value(self, val: object) -> list[ScalarValue] | None:
        if isinstance(val, (_TupleValue, _ListValue)):
            return self._validated_scalars(val.items)
        if isinstance(val, DictValue) and not val.opaque and 1 <= len(val.entries) <= MAX_LOOP_UNROLLS:
            return self._validated_scalars(val.entries.keys())
        return None

    def _sequence_from_range(self, call: ast.Call, *, allow_empty: bool) -> list[ScalarValue] | None:
        if self.bindings.is_shadowed(call.func) or self.bindings.has_binding_in_scope(  # type: ignore[arg-type]
            self.bindings.scope_of(call.func), "range"
        ):
            return None
        if not (1 <= len(call.args) <= 3):
            return None
        evaluated = [self._eval(arg) for arg in call.args]
        if not all(isinstance(v, int) and not isinstance(v, bool) for v in evaluated):
            return None
        int_args = [int(v) for v in evaluated]  # type: ignore[arg-type]
        if len(int_args) == 3 and int_args[2] == 0:
            return None
        rng = range(*int_args)
        if (not allow_empty and not rng) or rng[MAX_LOOP_UNROLLS:]:
            return None
        return list(rng)

    def _sequence_from_attr_call(self, call: ast.Call, func: ast.Attribute) -> list[ScalarValue] | None:
        attr = func.attr
        if attr == "split" and len(call.args) <= 2:
            return self._sequence_from_split(func.value, call.args)  # type: ignore[return-value]
        if attr in ("keys", "values") and not call.args:
            d = self._eval(func.value)
            if isinstance(d, DictValue) and not d.opaque and 1 <= len(d.entries) <= MAX_LOOP_UNROLLS:
                if attr == "keys":
                    return self._validated_scalars(d.entries.keys())
                return self._validated_scalars(d.entries.values())
        return None

    def _sequence_from_split(self, base_node: ast.expr, args: list[ast.expr]) -> list[str] | None:
        base = self._eval(base_node)
        if not isinstance(base, str):
            return None
        if not args:
            parts = base.split()
        else:
            sep = self._eval(args[0])
            if not isinstance(sep, str) or not sep:
                return None
            if len(args) == 2:
                maxsplit = self._eval(args[1])
                if not isinstance(maxsplit, int) or isinstance(maxsplit, bool):
                    return None
                parts = base.split(sep, maxsplit)
            else:
                parts = base.split(sep)
        return parts if 1 <= len(parts) <= MAX_LOOP_UNROLLS else None

    def dict_value(self, node: ast.expr | None) -> DictValue:
        val = self._eval(node)
        if isinstance(val, DictValue):
            return val
        return DictValue(entries={}, opaque=True)

    def _dict_value_settings(self, d: DictValue) -> list[tuple[object, object]]:
        items: list[tuple[object, object]] = [(OPAQUE, None)] if d.opaque else []
        for key, value in d.entries.items():
            items.append((key.lower(), self.scalar_to_str(value)) if isinstance(key, str) else (OPAQUE, None))
        return items

    def settings(self, node: ast.expr | None) -> list[tuple[object, object]]:
        """Ordered case-insensitive (key, value) settings of a dict expression; [(OPAQUE, None)] when unlisted."""
        if isinstance(node, ast.Name):
            return self._name_settings(node)
        if isinstance(node, ast.Dict):
            return self._dict_literal_settings(node)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "dict":
            return self._dict_call_settings(node)
        return self._dict_value_settings(self.dict_value(node))

    def _name_settings(self, node: ast.Name) -> list[tuple[object, object]]:
        if node in self._settings:
            return self._settings[node]
        if node in self._resolving:
            return [(OPAQUE, None)]
        if self._scope_overrides and not self.bindings.is_shadowed(node):
            scope = self.bindings.scope_of(node)
            owner = self.bindings.owner_of(scope, node.id)
            if (owner, node.id) in self._scope_overrides:
                override_val = self._scope_overrides[(owner, node.id)]
                return (
                    self._dict_value_settings(override_val) if isinstance(override_val, DictValue) else [(OPAQUE, None)]
                )
        loop_stmt = self.bindings.reaching_loop_statement(node)
        if loop_stmt is not None and loop_stmt in self._loop_overrides:
            return [(OPAQUE, None)]
        self._resolving.add(node)
        try:
            resolution = self.bindings.resolve(node)
            if resolution is None:
                resolved: list[tuple[object, object]] = [(OPAQUE, None)]
            else:
                merged = _merge_settings([self.settings(value) for value in resolution.values])
                changes: list[tuple[object, object]] = [
                    (OPAQUE, None)
                    if k is OPAQUE or k is _SEQUENCE_MUTATION or not isinstance(k, str)
                    else (k.lower(), v)
                    for k, v in resolution.changes
                ]
                resolved = merged + changes
        finally:
            self._resolving.discard(node)
        self._settings[node] = resolved
        return resolved

    def _dict_literal_settings(self, node: ast.Dict) -> list[tuple[object, object]]:
        out: list[tuple[object, object]] = []
        for key, value in zip(node.keys, node.values, strict=True):
            if key is None:
                out.extend(self.settings(value))
            else:
                out.append(self.setting(key, value))
        return out

    def _dict_call_settings(self, node: ast.Call) -> list[tuple[object, object]]:
        out: list[tuple[object, object]] = []
        for arg in node.args:
            out.extend(self.settings(arg))
        out.extend(self.keyword_settings(node.keywords))
        return out

    def keyword_settings(self, keywords: list[ast.keyword]) -> list[tuple[object, object]]:
        settings: list[tuple[object, object]] = []
        for keyword in keywords:
            if keyword.arg is None:
                settings.extend(self.settings(keyword.value))
            else:
                settings.append((keyword.arg.lower(), self.string(keyword.value)))
        return settings

    def setting(self, key: ast.expr, value: ast.expr) -> tuple[object, object]:
        key_text = self.string(key)
        return (key_text.lower(), self.string(value)) if isinstance(key_text, str) else (OPAQUE, None)

    def option_setting(self, call: ast.Call) -> tuple[object, object]:
        """`.option("k", "v")` / `.option(key="k", value="v")`; opaque when the key cannot be read."""
        arguments: dict[str, ast.expr] = dict(zip(("key", "value"), call.args, strict=False))
        arguments.update({keyword.arg: keyword.value for keyword in call.keywords if keyword.arg})
        is_readable = set(arguments) == {"key", "value"} and len(call.args) + len(call.keywords) == 2
        return self.setting(arguments["key"], arguments["value"]) if is_readable else (OPAQUE, None)

    @staticmethod
    def scalar_to_str(val: object) -> str | UnknownValue:
        if isinstance(val, str):
            return val if len(val) <= MAX_STRING_LENGTH else UNKNOWN
        if isinstance(val, (int, float, bool)):
            text = str(val)
            return text if len(text) <= MAX_STRING_LENGTH else UNKNOWN
        return UNKNOWN

    def _eval(self, node: ast.expr | None) -> object:
        if node is None or self._depth >= MAX_EXPR_DEPTH:
            return UNKNOWN
        self._depth += 1
        try:
            if isinstance(node, ast.Constant):
                if isinstance(node.value, str):
                    return node.value if len(node.value) <= MAX_STRING_LENGTH else UNKNOWN
                if isinstance(node.value, (int, float, bool)):
                    return node.value
                return UNKNOWN
            if isinstance(node, ast.Name):
                return self._eval_name(node)
            if isinstance(node, ast.JoinedStr):
                return self._eval_joined_str(node)
            if isinstance(node, ast.BinOp):
                return self._eval_binop(node)
            if isinstance(node, ast.Dict):
                return self._eval_dict_literal(node)
            if isinstance(node, ast.Tuple):
                if len(node.elts) > MAX_CANDIDATES * 4:
                    return UNKNOWN
                return _TupleValue(tuple(self._eval(elt) for elt in node.elts))
            if isinstance(node, ast.List):
                if len(node.elts) > MAX_CANDIDATES * 4:
                    return UNKNOWN
                return _ListValue(tuple(self._eval(elt) for elt in node.elts))
            if isinstance(node, ast.Subscript):
                return self._eval_subscript(node)
            if isinstance(node, ast.Call):
                return self._eval_call(node)
            return UNKNOWN
        finally:
            self._depth -= 1

    def _eval_name(self, node: ast.Name) -> object:
        if node in self._values:
            return self._values[node]
        if node in self._resolving:
            return UNKNOWN
        if self._scope_overrides and not self.bindings.is_shadowed(node):
            scope = self.bindings.scope_of(node)
            owner = self.bindings.owner_of(scope, node.id)
            if (owner, node.id) in self._scope_overrides:
                val: object = self._scope_overrides[(owner, node.id)]
                self._values[node] = val
                return val
        loop_stmt = self.bindings.reaching_loop_statement(node)
        if loop_stmt is not None and loop_stmt in self._loop_overrides:
            val = self._loop_overrides[loop_stmt]
            self._values[node] = val
            return val
        self._resolving.add(node)
        try:
            resolution = self.bindings.resolve(node)
            if resolution is None:
                val = UNKNOWN
            else:
                candidates = [self._eval(expr) for expr in resolution.values]
                if any(isinstance(c, DictValue) for c in candidates):
                    dict_cands = [
                        c if isinstance(c, DictValue) else DictValue(entries={}, opaque=True) for c in candidates
                    ]
                    merged = _merge_dict_values(dict_cands)
                    dict_changes: list[tuple[object, object]] = [
                        (OPAQUE, None) if k is OPAQUE or k is _SEQUENCE_MUTATION else (k, v)
                        for k, v in resolution.changes
                    ]
                    val = _apply_dict_changes(merged, dict_changes) if dict_changes else merged
                else:
                    # Only mutable values (lists, or tuples nesting mutable objects) can be mutated
                    # through an alias; immutable values (scalars and tuples of immutables) only rebind
                    # the alias name when `alias += ...` runs in Python.
                    has_mutable_candidate = any(
                        isinstance(c, _ListValue) or (isinstance(c, _TupleValue) and not _is_deeply_immutable(c))
                        for c in candidates
                    )
                    if has_mutable_candidate and resolution.changes:
                        val = UNKNOWN
                    else:
                        first = candidates[0]
                        agreed = first is not UNKNOWN and all(_values_equal(first, c) for c in candidates[1:])
                        val = first if agreed else UNKNOWN
        finally:
            self._resolving.discard(node)
        self._values[node] = val
        return val

    def _eval_joined_str(self, node: ast.JoinedStr) -> str | UnknownValue:
        parts: list[str] = []
        total_len = 0
        for part in node.values:
            if isinstance(part, ast.Constant) and isinstance(part.value, str):
                seg = part.value
            elif isinstance(part, ast.FormattedValue):
                if part.conversion not in (-1, 115):
                    return UNKNOWN
                raw = self._eval(part.value)
                if not isinstance(raw, (str, int, float, bool)):
                    return UNKNOWN
                formatted_raw: object = str(raw) if part.conversion == 115 else raw
                if part.format_spec is not None:
                    spec = self.string(part.format_spec)
                    if not isinstance(spec, str) or _format_spec_exceeds_bounds(spec):
                        return UNKNOWN
                    try:
                        seg = format(formatted_raw, spec)
                    except (ValueError, TypeError):
                        return UNKNOWN
                else:
                    seg = str(formatted_raw)
            else:
                return UNKNOWN
            total_len += len(seg)
            if total_len > MAX_STRING_LENGTH:
                return UNKNOWN
            parts.append(seg)
        return "".join(parts)

    def _eval_binop(self, node: ast.BinOp) -> object:
        if isinstance(node.op, ast.Add):
            left = self._eval(node.left)
            right = self._eval(node.right)
            if isinstance(left, str) and isinstance(right, str):
                if len(left) + len(right) > MAX_STRING_LENGTH:
                    return UNKNOWN
                return left + right
            if isinstance(left, _TupleValue) and isinstance(right, _TupleValue):
                if len(left.items) + len(right.items) > MAX_CANDIDATES * 4:
                    return UNKNOWN
                return _TupleValue(left.items + right.items)
            return UNKNOWN
        if isinstance(node.op, ast.Mod):
            left = self._eval(node.left)
            if isinstance(left, str):
                return self._eval_percent_format(left, node.right)
        return UNKNOWN

    @classmethod
    def _percent_scalar(cls, val: object) -> str | int | float | UnknownValue:
        if isinstance(val, bool) or isinstance(cls.scalar_to_str(val), UnknownValue):
            return UNKNOWN
        if isinstance(val, (str, int, float)):
            return val
        return UNKNOWN

    def _eval_named_percent_format(
        self, template: str, named_fields: list[str], rhs_node: ast.expr
    ) -> str | UnknownValue:
        if not named_fields or _percent_template_exceeds_bounds(template):
            return UNKNOWN
        d = self._eval(rhs_node)
        if not isinstance(d, DictValue):
            return UNKNOWN
        resolved_map: dict[str, str | int | float] = {}
        for field_name in named_fields:
            entry = self._percent_scalar(d.entries.get(field_name, UNKNOWN))
            if isinstance(entry, UnknownValue):
                return UNKNOWN
            resolved_map[field_name] = entry
        if _percent_star_exceeds_bounds(template, resolved_map.values()):
            return UNKNOWN
        try:
            formatted = template % resolved_map
        except (KeyError, TypeError, ValueError, ZeroDivisionError, OverflowError):
            return UNKNOWN
        return formatted if len(formatted) <= MAX_STRING_LENGTH else UNKNOWN

    def _eval_percent_format(self, template: str, rhs_node: ast.expr) -> str | UnknownValue:
        if PERCENT_HUGE_WIDTH_PATTERN.search(template) or _percent_template_exceeds_bounds(template):
            return UNKNOWN
        named_fields = PERCENT_NAMED_FIELD_PATTERN.findall(template)
        if named_fields or "%(" in template:
            return self._eval_named_percent_format(template, named_fields, rhs_node)

        if isinstance(rhs_node, ast.Tuple):
            items = [self._percent_scalar(self._eval(elt)) for elt in rhs_node.elts]
            if any(isinstance(item, UnknownValue) for item in items):
                return UNKNOWN
            args_val: object = tuple(items)
        else:
            rhs_val = self._eval(rhs_node)
            if isinstance(rhs_val, _TupleValue):
                items = [self._percent_scalar(x) for x in rhs_val.items]
                if any(isinstance(x, UnknownValue) for x in items):
                    return UNKNOWN
                args_val = tuple(items)
            else:
                scalar = self._percent_scalar(rhs_val)
                if isinstance(scalar, UnknownValue):
                    return UNKNOWN
                args_val = scalar
        star_values: Iterable[object] = args_val if isinstance(args_val, tuple) else (args_val,)
        if _percent_star_exceeds_bounds(template, star_values):
            return UNKNOWN
        try:
            formatted = template % args_val
        except (TypeError, ValueError, ZeroDivisionError, OverflowError):
            return UNKNOWN
        return formatted if len(formatted) <= MAX_STRING_LENGTH else UNKNOWN

    def _eval_dict_literal(self, node: ast.Dict) -> DictValue:
        entries: dict[DictKey, object] = {}
        opaque = False
        for key, value in zip(node.keys, node.values, strict=True):
            if key is None:
                sub = self.dict_value(value)
                if sub.opaque:
                    entries.clear()
                    opaque = True
                for k, v in sub.entries.items():
                    entries.pop(k, None)
                    entries[k] = v
            else:
                key_val = self.dict_key(key)
                if not isinstance(key_val, UnknownValue):
                    entries.pop(key_val, None)
                    entries[key_val] = self._eval(value)
                else:
                    entries.clear()
                    opaque = True
        return DictValue(entries=entries, opaque=opaque)

    def _eval_dict_call(self, node: ast.Call) -> DictValue:
        entries: dict[DictKey, object] = {}
        opaque = False
        for arg in node.args:
            sub = self.dict_value(arg)
            if sub.opaque:
                entries.clear()
                opaque = True
            for k, v in sub.entries.items():
                entries.pop(k, None)
                entries[k] = v
        for keyword in node.keywords:
            if keyword.arg is None:
                sub = self.dict_value(keyword.value)
                if sub.opaque or any(not isinstance(k, str) for k in sub.entries):
                    entries.clear()
                    opaque = True
                    continue
                for k, v in sub.entries.items():
                    entries.pop(k, None)
                    entries[k] = v
            else:
                entries.pop(keyword.arg, None)
                entries[keyword.arg] = self._eval(keyword.value)
        return DictValue(entries=entries, opaque=opaque)

    def _eval_subscript(self, node: ast.Subscript) -> object:
        if isinstance(node.slice, ast.Slice):
            return UNKNOWN
        container = self._eval(node.value)
        if isinstance(container, DictValue):
            key = self.dict_key(node.slice)
            if isinstance(key, UnknownValue):
                return UNKNOWN
            return container.entries.get(key, UNKNOWN)
        if isinstance(container, (_TupleValue, _ListValue)):
            idx = self._eval(node.slice)
            if (
                isinstance(idx, int)
                and not isinstance(idx, bool)
                and -len(container.items) <= idx < len(container.items)
            ):
                return container.items[idx]
        if isinstance(container, str):
            idx = self._eval(node.slice)
            if isinstance(idx, int) and not isinstance(idx, bool) and -len(container) <= idx < len(container):
                return container[idx]
        return UNKNOWN

    def _eval_call(self, node: ast.Call) -> object:
        if isinstance(node.func, ast.Name) and node.func.id == "dict":
            return self._eval_dict_call(node)
        callee = _callee_name(node.func)
        if callee == "getResolvedOptions":
            return self._eval_resolved_options(node)
        if callee == "get_workflow_run_properties":
            return self._eval_workflow_run_properties(node)
        if isinstance(node.func, ast.Attribute):
            attr = node.func.attr
            if attr == "get" and not node.keywords and 1 <= len(node.args) <= 2:
                recv = self._eval(node.func.value)
                if isinstance(recv, DictValue):
                    key = self.dict_key(node.args[0])
                    if isinstance(key, UnknownValue):
                        return UNKNOWN
                    if key in recv.entries:
                        return recv.entries[key]
                    if recv.opaque:
                        return UNKNOWN
                    return self._eval(node.args[1]) if len(node.args) == 2 else UNKNOWN
            if attr == "format":
                recv = self._eval(node.func.value)
                if isinstance(recv, str):
                    return self._eval_str_format(recv, node)
            if attr in {"upper", "lower", "strip", "lstrip", "rstrip", "replace"}:
                recv = self._eval(node.func.value)
                if isinstance(recv, str):
                    return self._eval_str_method(recv, attr, node)
        return UNKNOWN

    def _eval_resolved_options(self, node: ast.Call) -> DictValue:
        requested = self._requested_options(node)
        if self._context is None or requested is None:
            return DictValue(entries={}, opaque=True)
        argv: dict[str, object] = dict(self._context.job_args)
        if (
            self._context.has_default_workflow_run
            and self._context.workflow_run_id is None
            and "--WORKFLOW_RUN_ID" not in argv
        ):
            argv["--WORKFLOW_RUN_ID"] = _CURRENT_WORKFLOW_RUN
        entries: dict[DictKey, object] = {
            option.replace("-", "_"): argv.get(f"--{option}", UNKNOWN)
            for option in (*requested, *RESOLVED_OPTIONS_BUILTINS)
        }
        return DictValue(entries=entries)

    def _requested_options(self, node: ast.Call) -> tuple[str, ...] | None:
        if node.keywords or len(node.args) != 2 or not _is_sys_argv(node.args[0]) or self._sys_argv_changed:
            return None
        options = self._eval(node.args[1])
        if isinstance(options, (_TupleValue, _ListValue)) and all(isinstance(opt, str) for opt in options.items):
            return tuple(opt for opt in options.items if isinstance(opt, str))
        return None

    def _eval_workflow_run_properties(self, node: ast.Call) -> object:
        """
        Resolve `glue.get_workflow_run_properties(Name=..., RunId=...)` only when both
        arguments resolve to the workflow and run represented by `self._context`.
        Unmatched or indeterminate lookups stay UNKNOWN so another run's or fallback's
        properties are never substituted.
        """
        if node.args or self._context is None or not self._context.workflow_name:
            return UNKNOWN
        kwargs: dict[str, object] = {}
        for keyword in node.keywords:
            if keyword.arg is None:
                sub = self.dict_value(keyword.value)
                if sub.opaque or any(not isinstance(k, str) for k in sub.entries):
                    return UNKNOWN
                kwargs.update({k: v for k, v in sub.entries.items() if isinstance(k, str)})
            else:
                kwargs[keyword.arg] = self._eval(keyword.value)
        if set(kwargs) != {"Name", "RunId"}:
            return UNKNOWN
        requested_name = kwargs["Name"]
        requested_run_id = kwargs["RunId"]
        if not isinstance(requested_name, str) or requested_name != self._context.workflow_name:
            return UNKNOWN
        if self._context.workflow_run_id is not None:
            if not isinstance(requested_run_id, str) or requested_run_id != self._context.workflow_run_id:
                return UNKNOWN
        elif self._context.has_default_workflow_run:
            if requested_run_id is not _CURRENT_WORKFLOW_RUN:
                return UNKNOWN
        else:
            return UNKNOWN
        run_props_entries: dict[DictKey, object] = dict(self._context.run_props)
        run_props = DictValue(entries=run_props_entries, opaque=self._context.run_props_opaque)
        return DictValue(entries={"RunProperties": run_props}, opaque=False)

    def _collect_format_args(self, call: ast.Call) -> tuple[list[object], dict[str, object]] | None:
        pos_args: list[object] = []
        for arg in call.args:
            if isinstance(arg, ast.Starred):
                seq = self._eval(arg.value)
                if not isinstance(seq, (_TupleValue, _ListValue)):
                    return None
                pos_args.extend(seq.items)
            else:
                pos_args.append(self._eval(arg))

        kw_args: dict[str, object] = {}
        for keyword in call.keywords:
            if keyword.arg is None:
                sub = self.dict_value(keyword.value)
                if sub.opaque or any(not isinstance(k, str) for k in sub.entries):
                    kw_args.clear()
                    continue
                kw_args.update({k: v for k, v in sub.entries.items() if isinstance(k, str)})
            else:
                kw_args[keyword.arg] = self._eval(keyword.value)
        return pos_args, kw_args

    def _eval_str_format(self, template: str, call: ast.Call) -> str | UnknownValue:
        collected = self._collect_format_args(call)
        if collected is None:
            return UNKNOWN
        pos_args, kw_args = collected
        try:
            parsed = list(string.Formatter().parse(template))
        except ValueError:
            return UNKNOWN

        parts: list[str] = []
        total_len = 0
        auto_idx = 0
        used_auto = False
        used_manual = False
        for literal_text, field_name, format_spec, conversion in parsed:
            if literal_text:
                total_len += len(literal_text)
                if total_len > MAX_STRING_LENGTH:
                    return UNKNOWN
                parts.append(literal_text)
            if field_name is None:
                continue
            if conversion not in (None, "s") or "." in field_name or "[" in field_name:
                return UNKNOWN
            if field_name == "":
                if used_manual or auto_idx >= len(pos_args):
                    return UNKNOWN
                used_auto = True
                raw_val = pos_args[auto_idx]
                auto_idx += 1
            elif field_name.isdigit():
                if used_auto or int(field_name) >= len(pos_args):
                    return UNKNOWN
                used_manual = True
                raw_val = pos_args[int(field_name)]
            else:
                raw_val = kw_args.get(field_name, UNKNOWN)

            formatted = self._apply_format_spec(raw_val, format_spec, conversion)
            if not isinstance(formatted, str):
                return UNKNOWN
            total_len += len(formatted)
            if total_len > MAX_STRING_LENGTH:
                return UNKNOWN
            parts.append(formatted)
        return "".join(parts)

    def _apply_format_spec(
        self, raw_val: object, format_spec: str | None, conversion: str | None
    ) -> str | UnknownValue:
        if not isinstance(raw_val, (str, int, float, bool)):
            return UNKNOWN
        val: object = str(raw_val) if conversion == "s" else raw_val
        if not format_spec:
            return self.scalar_to_str(val)
        if _format_spec_exceeds_bounds(format_spec):
            return UNKNOWN
        try:
            rendered = format(val, format_spec)
        except (ValueError, TypeError):
            return UNKNOWN
        return rendered if len(rendered) <= MAX_STRING_LENGTH else UNKNOWN

    def _eval_str_method(self, base: str, attr: str, call: ast.Call) -> str | UnknownValue:
        if call.keywords:
            return UNKNOWN
        if attr in ("upper", "lower") and not call.args:
            return getattr(base, attr)()
        if attr in ("strip", "lstrip", "rstrip"):
            if not call.args:
                return getattr(base, attr)()
            if len(call.args) == 1:
                chars = self._eval(call.args[0])
                if isinstance(chars, str):
                    return getattr(base, attr)(chars)
            return UNKNOWN
        if attr == "replace" and len(call.args) in (2, 3):
            old = self._eval(call.args[0])
            new = self._eval(call.args[1])
            if not (isinstance(old, str) and isinstance(new, str)):
                return UNKNOWN
            if len(call.args) == 3:
                count = self._eval(call.args[2])
                if not isinstance(count, int) or isinstance(count, bool):
                    return UNKNOWN
                result = base.replace(old, new, count)
            else:
                result = base.replace(old, new)
            return result if len(result) <= MAX_STRING_LENGTH else UNKNOWN
        return UNKNOWN


@dataclass(frozen=True)
class ParsedScript:
    tree: ast.Module
    bindings: ScriptBindings
    calls: tuple[ast.Call, ...]
    literal_pairs: tuple[tuple[str | None, str | None], ...]


_PARSED_SCRIPT_CACHE: LRUCache[str, ParsedScript] = LRUCache(maxsize=PARSED_AST_CACHE_SIZE)


def parse_python_script(source_code: str) -> ParsedScript | None:
    if source_code in _PARSED_SCRIPT_CACHE:
        return _PARSED_SCRIPT_CACHE[source_code]
    try:
        tree = ast.parse(source_code)
        bindings = ScriptBindings(tree)
        calls = tuple(
            sorted(
                (node for node in ast.walk(tree) if isinstance(node, ast.Call)),
                key=lambda node: (node.lineno, node.col_offset),
            )
        )
        pairs = tuple(literal_key_value_pairs(tree))
    except (SyntaxError, ValueError, RecursionError) as exc:
        logger.debug("Glue script could not be parsed as Python AST: %s", exc)
        return None
    parsed = ParsedScript(tree=tree, bindings=bindings, calls=calls, literal_pairs=pairs)
    _PARSED_SCRIPT_CACHE[source_code] = parsed
    return parsed


@dataclass(frozen=True)
class ExecutionSlice:
    slice_id: str
    reader: ScriptReader
    excluded_loops: frozenset[ast.For]
    active_top_loop: ast.For | None = None
    loop_overrides: tuple[tuple[ast.For, ScalarValue], ...] = ()

    def call_included(self, call: ast.Call, bindings: ScriptBindings) -> bool:
        return not (
            self.excluded_loops and any(loop in self.excluded_loops for loop in bindings.enclosing_for_loops(call))
        )

    def compatible_with(self, other: "ExecutionSlice") -> bool:
        """True when two slices agree on every enclosing loop iteration they share."""
        if not self.loop_overrides or not other.loop_overrides:
            return True
        own_map = dict(self.loop_overrides)
        for loop, val in other.loop_overrides:
            if loop in own_map and not _values_equal(own_map[loop], val):
                return False
        return True


def is_lineage_io_call(call: ast.Call) -> bool:
    func = call.func
    if not isinstance(func, ast.Attribute):
        return False
    method = func.attr
    if method in GLUE_IO_FLAT_METHODS:
        return True
    parent_attr = func.value.attr if isinstance(func.value, ast.Attribute) else None
    if parent_attr in ("create_dynamic_frame", "write_dynamic_frame") and method in (
        "from_options",
        "from_catalog",
        "from_jdbc_conf",
    ):
        return True
    has_chain = False
    node: ast.expr = func.value
    while isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
        has_chain = True
        node = node.func.value
    if not has_chain and method == "table" and not (isinstance(node, ast.Attribute) and node.attr == "read"):
        return True
    if not isinstance(node, ast.Attribute):
        return False
    if node.attr == "read":
        return method in SPARK_READ_TERMINALS
    if node.attr == "write":
        return method in SPARK_WRITE_TERMINALS
    return False


def _find_loops_with_io(
    tree: ast.Module,
    bindings: ScriptBindings,
    io_call_predicate: Callable[[ast.Call], bool],
) -> set[ast.For]:
    loops: set[ast.For] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and io_call_predicate(node):
            loops.update(bindings.enclosing_for_loops(node))
    return loops


def build_execution_slices(
    tree: ast.Module,
    context: ParameterContext | None = None,
    bindings: ScriptBindings | None = None,
    io_call_predicate: Callable[[ast.Call], bool] = is_lineage_io_call,
) -> list[ExecutionSlice]:
    """
    Build per-iteration readers for constant/resolved `for` loops enclosing lineage I/O
    calls while keeping sibling top-level I/O loops isolated into separate slices.
    """
    shared_bindings = bindings or ScriptBindings(tree)
    base_reader = ScriptReader(tree, context=context, bindings=shared_bindings)
    loops_with_io = _find_loops_with_io(tree, shared_bindings, io_call_predicate)

    all_for_nodes = sorted(
        (node for node in ast.walk(tree) if isinstance(node, ast.For) and node in loops_with_io),
        key=node_position,
    )
    if not all_for_nodes:
        return [ExecutionSlice(slice_id="slice_0", reader=base_reader, excluded_loops=frozenset())]

    # Outermost I/O loops at the current scope (both unrollable and dynamic) stay isolated
    # from each other so a dynamic sibling loop never leaks into an unrolled sibling's slice.
    outer_io_loops: list[ast.For] = []
    outer_io_set: set[ast.For] = set()
    for for_node in all_for_nodes:
        enclosing = shared_bindings.enclosing_for_loops(for_node)
        if any(anc in outer_io_set for anc in enclosing):
            continue
        outer_io_loops.append(for_node)
        outer_io_set.add(for_node)

    unrollable_outer: dict[ast.For, list[ScalarValue]] = {}
    for for_node in outer_io_loops:
        if isinstance(for_node.target, ast.Name):
            seq = base_reader.sequence(for_node.iter)
            if seq is not None:
                unrollable_outer[for_node] = seq

    if not unrollable_outer and len(outer_io_loops) <= 1:
        return [ExecutionSlice(slice_id="slice_0", reader=base_reader, excluded_loops=frozenset())]

    all_outer_set = frozenset(outer_io_loops)
    slices: list[ExecutionSlice] = []
    unrolled_count = 0

    for loop_idx, top_loop in enumerate(outer_io_loops):
        other_loops = all_outer_set - {top_loop}
        top_values = unrollable_outer.get(top_loop)
        if top_values is None:
            slices.append(
                ExecutionSlice(
                    slice_id=f"loop_{loop_idx}_unexpanded",
                    reader=base_reader,
                    excluded_loops=other_loops,
                    active_top_loop=top_loop,
                )
            )
            continue
        loop_slices = _expand_nested_loops(
            tree=tree,
            context=context,
            bindings=shared_bindings,
            current_loop=top_loop,
            current_values=top_values,
            parent_overrides={},
            excluded_loops=other_loops,
            loops_with_io=loops_with_io,
            active_top_loop=top_loop,
            prefix=f"loop_{loop_idx}",
        )
        unrolled_count += len(loop_slices)
        if unrolled_count > MAX_LOOP_UNROLLS:
            return [ExecutionSlice(slice_id="slice_0", reader=base_reader, excluded_loops=frozenset())]
        slices.extend(loop_slices)

    return slices


def _expand_nested_loops(
    tree: ast.Module,
    context: ParameterContext | None,
    bindings: ScriptBindings,
    current_loop: ast.For,
    current_values: list[ScalarValue],
    parent_overrides: dict[ast.For, ScalarValue],
    excluded_loops: frozenset[ast.For],
    loops_with_io: set[ast.For],
    active_top_loop: ast.For,
    prefix: str,
) -> list[ExecutionSlice]:
    direct_child_loops = sorted(
        (
            node
            for node in ast.walk(current_loop)
            if isinstance(node, ast.For)
            and node is not current_loop
            and node in loops_with_io
            and bindings.enclosing_for_loops(node)[-1:] == [current_loop]
        ),
        key=node_position,
    )
    out: list[ExecutionSlice] = []
    for idx, val in enumerate(current_values):
        overrides = {**parent_overrides, current_loop: val}
        override_tuple = tuple(overrides.items())
        reader = ScriptReader(tree, context=context, bindings=bindings, loop_overrides=overrides)
        slice_prefix = f"{prefix}_{idx}"
        if not direct_child_loops:
            out.append(
                ExecutionSlice(
                    slice_id=slice_prefix,
                    reader=reader,
                    excluded_loops=excluded_loops,
                    active_top_loop=active_top_loop,
                    loop_overrides=override_tuple,
                )
            )
        else:
            child_set = frozenset(direct_child_loops)
            unrollable_children = {
                child: seq
                for child in direct_child_loops
                if isinstance(child.target, ast.Name) and (seq := reader.sequence(child.iter)) is not None
            }
            if not unrollable_children and len(direct_child_loops) <= 1:
                out.append(
                    ExecutionSlice(
                        slice_id=slice_prefix,
                        reader=reader,
                        excluded_loops=excluded_loops,
                        active_top_loop=active_top_loop,
                        loop_overrides=override_tuple,
                    )
                )
            else:
                for child_idx, child_loop in enumerate(direct_child_loops):
                    child_excluded = excluded_loops | (child_set - {child_loop})
                    child_vals = unrollable_children.get(child_loop)
                    if child_vals is None:
                        out.append(
                            ExecutionSlice(
                                slice_id=f"{slice_prefix}_c{child_idx}_unexpanded",
                                reader=reader,
                                excluded_loops=child_excluded,
                                active_top_loop=active_top_loop,
                                loop_overrides=override_tuple,
                            )
                        )
                    else:
                        out.extend(
                            _expand_nested_loops(
                                tree=tree,
                                context=context,
                                bindings=bindings,
                                current_loop=child_loop,
                                current_values=child_vals,
                                parent_overrides=overrides,
                                excluded_loops=child_excluded,
                                loops_with_io=loops_with_io,
                                active_top_loop=active_top_loop,
                                prefix=f"{slice_prefix}_c{child_idx}",
                            )
                        )
        if len(out) > MAX_LOOP_UNROLLS:
            break
    return out
