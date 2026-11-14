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
are case-insensitive. When a ParameterContext is supplied from Glue job defaults,
triggers, job runs or workflow run properties, values bound through
getResolvedOptions(...) and get_workflow_run_properties(...) and derived via
f-strings, .format(), +, %, string methods, lookup dicts and bounded constant
loops are resolved per execution context (ADR:2026-11-13-glue-parameterized-lineage-evaluates-per-run-context).
A ref needs a known table. An unknown database or schema is left unset, and the
resolver links the table only when its name matches a single table
(ADR:2026-10-22-glue-snowflake-refs-with-unknown-schema-link-only-unique-tables).

Only Python scripts are read: a Scala Glue job does not parse as Python and
gets no Snowflake lineage from its script.
"""

import ast
import re
import string
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass, replace

from cachetools import LRUCache

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
# load() / save() parameters that are not connector options; any other keyword is one
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

# Snowflake identifiers: "ORDERS.V2" is one quoted name, FINANCE.CURATED.ORDERS are three
QUALIFIED_NAME_PART_PATTERN = re.compile(r'"[^"]*"|[^.]+')
PERCENT_NAMED_FIELD_PATTERN = re.compile(r"%\(([^)]+)\)[-#0 +]*\d*(?:\.\d+)?[diouxXeEfFgGcrsa]")
PERCENT_HUGE_WIDTH_PATTERN = re.compile(r"%(?:\([^)]*\))?[-#0 +]*\d{4,}")
# [[fill]align][sign][z][#][0][width][grouping][.precision][type]
FORMAT_SPEC_PATTERN = re.compile(
    r"^(?:(.)?([<>=^]))?([+\- ])?(z)?(#)?(0)?(?P<width>\d*)([,_])?(?:\.(?P<precision>\d*))?([a-zA-Z%]?)$"
)
PERCENT_CONVERSION_PATTERN = re.compile(
    r"%(?:\((?P<name>[^)]*)\))?[-#0 +]*(?P<width>\d+|\*)?(?:\.(?P<precision>\d+|\*))?[hlL]?(?P<conv>[diouxXeEfFgGcrsa%])"
)


class _Unknown:
    """A value that is set but cannot be known without running the script."""

    def __repr__(self) -> str:
        return "UNKNOWN"


UNKNOWN = _Unknown()
ABSENT = object()
# an expansion whose keys cannot be listed (**get_options()): it may set any key
OPAQUE = object()


@dataclass(frozen=True)
class ParameterContext:
    """Glue job arguments and workflow run properties for one execution context."""

    job_args: tuple[tuple[str, str], ...] = ()
    run_props: tuple[tuple[str, str], ...] = ()
    job_args_opaque: bool = False
    run_props_opaque: bool = False

    @classmethod
    def from_mappings(
        cls,
        job_args: Mapping[str, str] | None = None,
        run_props: Mapping[str, str] | None = None,
        job_args_opaque: bool = False,
        run_props_opaque: bool = False,
    ) -> "ParameterContext":
        return cls(
            job_args=tuple(sorted((str(k), str(v)) for k, v in (job_args or {}).items() if v is not None)),
            run_props=tuple(sorted((str(k), str(v)) for k, v in (run_props or {}).items() if v is not None)),
            job_args_opaque=job_args_opaque,
            run_props_opaque=run_props_opaque,
        )


@dataclass(frozen=True)
class SnowflakeRef:
    table: str
    database: str | None = None
    schema: str | None = None


@dataclass
class _DictValue:
    entries: dict[str, object]
    opaque: bool = False


FUNCTIONS = (ast.FunctionDef, ast.AsyncFunctionDef)
COMPREHENSIONS = (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
# names bound here are visible only inside: lambda parameters, comprehension targets, class attributes
SHADOWING_NODES = (ast.Lambda, ast.ClassDef, *COMPREHENSIONS)
LOOPS = (ast.For, ast.AsyncFor, ast.While)
# dict methods that change a dict in place; those in KEYED_METHODS take the key they change first
KEYED_METHODS = {"pop", "setdefault", "__setitem__", "__delitem__"}
MUTATING_METHODS = {"update", "popitem", "clear", *KEYED_METHODS}
# more assignments than this reaching one read are not worth merging
# ADR:2026-10-22-glue-snowflake-refs-with-unknown-schema-link-only-unique-tables
MAX_CANDIDATES = 16
# bounds on recursive expression evaluation, string size, and constant-loop unrolling
# ADR:2026-11-13-glue-parameterized-lineage-evaluates-per-run-context
MAX_EXPR_DEPTH = 32
MAX_STRING_LENGTH = 4096
MAX_LOOP_UNROLLS = 32
# names whose resolved value is kept per script
MEMO_SIZE = 1024


def _digits_exceed_max_string_length(digits: str) -> bool:
    stripped = digits.lstrip("0")
    if not stripped:
        return False
    if len(stripped) > len(str(MAX_STRING_LENGTH)):
        return True
    return int(stripped) > MAX_STRING_LENGTH


def _format_spec_exceeds_bounds(spec: str) -> bool:
    """True when a format spec's width or precision would allocate past MAX_STRING_LENGTH.

    A spec that is not a plain format-spec mini-language instance (including a nested
    ``{field}``) counts as exceeding: ``format()`` would reject it anyway, so UNKNOWN
    is the safe result and no allocation happens either way.
    """
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
    """True when any %-conversion's literal width or precision exceeds MAX_STRING_LENGTH."""
    for match in PERCENT_CONVERSION_PATTERN.finditer(template):
        if match.group("conv") == "%":
            continue
        for digits in (match.group("width"), match.group("precision")):
            if digits and digits != "*" and _digits_exceed_max_string_length(digits):
                return True
    return False


def _percent_star_exceeds_bounds(template: str, values: Iterable[object]) -> bool:
    """Conservative *-width/precision check: any huge resolved int operand rejects the format."""
    if "*" not in template:
        return False
    return any(isinstance(v, int) and not isinstance(v, bool) and abs(v) > MAX_STRING_LENGTH for v in values)


@dataclass(frozen=True)
class _Binding:
    statement: ast.AST
    value: ast.expr | None  # None: not a plain `name = value` (parameter, loop target, import...)
    # written from another function (global / nonlocal): it runs whenever that function is called
    is_remote: bool = False


@dataclass
class _Resolution:
    values: list[ast.expr]  # every assignment that may be in effect at the read
    changes: list[tuple]  # settings for in-place changes: (key, UNKNOWN), or (OPAQUE, None)


class _Bindings:
    """
    Assignments of module-level and function-local names, and which of them may
    be in effect where a name is read.
    """

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
        self._declared: dict[tuple[ast.AST, str], type] = {}  # (function, name) -> ast.Global / ast.Nonlocal
        self._bindings: dict[tuple[ast.AST, str], list[_Binding]] = {}
        self._shadows: dict[ast.AST, set[str]] = {}
        self._changes: dict[tuple[ast.AST, str], list[tuple]] = {}
        self._nonlocal_bindings: list[tuple[ast.AST, str, _Binding]] = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.Global, ast.Nonlocal)):
                scope = self._scope_of(node)
                self._declared.update({(scope, name): type(node) for name in node.names})
        # every binding is indexed before a nonlocal or an in-place change is given its owner
        for node in ast.walk(tree):
            self._index(node)
        for function, name, binding in self._nonlocal_bindings:
            self._bindings.setdefault((self._owner(self._scope_of(function), name), name), []).append(binding)
        for node in ast.walk(tree):
            self._index_change(node)
        self._carry_changes_to_aliased_dicts()

    # --- indexing

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
            if isinstance(container, FUNCTIONS):  # `name: dict` in a function makes it local, with no value
                self._bindings.setdefault((container, node.target.id), [])

    def _index_store(self, node: ast.Name) -> None:
        parent = self._parents[node]
        if isinstance(parent, ast.AnnAssign) and parent.value is None:
            return  # handled with the annotation
        if isinstance(parent, ast.AugAssign) and isinstance(parent.op, ast.BitOr):
            return  # d |= {...}: an in-place change, see _index_change
        statement = self._statement_of(node)
        value = None
        if isinstance(parent, ast.Assign) and node in parent.targets:
            value = parent.value
        elif isinstance(parent, ast.AnnAssign) and node is parent.target:
            value = parent.value
        container = self._container_of(node)
        while isinstance(parent, ast.NamedExpr) and isinstance(container, COMPREHENSIONS):
            container = self._container_of(container)  # a walrus in a comprehension binds around it
        self._bind(node.id, _Binding(statement, value), container)

    def _bind(self, name: str, binding: _Binding, container: ast.AST) -> None:
        if isinstance(container, SHADOWING_NODES):
            self._shadows.setdefault(container, set()).add(name)
            return
        declared = self._declared.get((container, name))
        if declared is ast.Nonlocal:  # owned by the enclosing function binding it, known once all are indexed
            self._nonlocal_bindings.append((container, name, replace(binding, is_remote=True)))
            return
        if declared is ast.Global:
            container, binding = self._module, replace(binding, is_remote=container is not self._module)
        self._bindings.setdefault((container, name), []).append(binding)

    def _carry_changes_to_aliased_dicts(self) -> None:
        """`opts = sf_options; opts["k"] = v` changes the dict sf_options names too."""
        aliases = [
            (owner, name, binding.value)
            for (owner, name), bindings in self._bindings.items()
            for binding in bindings
            if isinstance(binding.value, ast.Name) and not self._is_shadowed(binding.value)
        ]
        for _ in aliases:  # a chain of aliases is at most as long as the list
            carried = False
            for owner, name, source in aliases:
                changes = self._changes.get((owner, name), [])
                target = self._changes.setdefault((self._owner(self._scope_of(source), source.id), source.id), [])
                new = [change for change in changes if change not in target]
                target.extend(new)
                carried = carried or bool(new)
            if not carried:
                break

    def _index_change(self, node: ast.AST) -> None:
        """d["k"] = v, del d["k"], d |= {...}, d.update(...), d.pop("k")..."""
        if isinstance(node, ast.Subscript) and not isinstance(node.ctx, ast.Load):
            target, keys = node.value, [node.slice]
        elif isinstance(node, ast.AugAssign) and isinstance(node.op, ast.BitOr):
            target, keys = node.target, _changed_keys(node.value)
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in MUTATING_METHODS:
            target, keys = node.func.value, _method_changed_keys(node)
        else:
            return
        if isinstance(target, ast.Name) and not self._is_shadowed(target):
            owner = self._owner(self._scope_of(target), target.id)
            self._changes.setdefault((owner, target.id), []).extend(
                (text, UNKNOWN) if (text := _literal_str(key)) else (OPAQUE, None) for key in keys
            )

    # --- scopes

    def _container_of(self, node: ast.AST) -> ast.AST:
        """The function, module, lambda, comprehension or class body a binding at `node` belongs to."""
        previous, child, parent = None, node, self._parents.get(node)
        while parent is not None:
            if isinstance(parent, (*FUNCTIONS, ast.ClassDef)) and child in parent.body:
                return parent
            if isinstance(parent, ast.Lambda) and child is parent.body:
                return parent
            if isinstance(parent, ast.arguments) and isinstance(child, ast.arg):
                return self._parents[parent]  # the function or lambda the parameter belongs to
            if isinstance(parent, ast.comprehension) and child is parent.target:
                return self._parents[parent]
            # inside a comprehension, except its first iterable, which runs in the enclosing scope
            if isinstance(parent, COMPREHENSIONS):
                first = parent.generators[0]
                if not (child is first and previous is first.iter):
                    return parent
            previous, child, parent = child, parent, self._parents.get(parent)
        return self._module

    def _scope_of(self, node: ast.AST) -> ast.AST:
        """The function or module whose names a read at `node` sees first."""
        container = self._container_of(node)
        while isinstance(container, SHADOWING_NODES):
            container = self._container_of(container)
        return container

    def _shadowing_containers(self, name: ast.Name) -> list[ast.AST]:
        """The lambdas, comprehensions and class bodies between a read and its function or module."""
        containers, container = [], self._container_of(name)
        while isinstance(container, SHADOWING_NODES):
            containers.append(container)
            container = self._container_of(container)
        return containers

    def _is_shadowed(self, name: ast.Name) -> bool:
        return any(name.id in self._shadows.get(container, ()) for container in self._shadowing_containers(name))

    def _owner(self, scope: ast.AST, name: str) -> ast.AST:
        """The function or module holding the assignments a read of `name` in `scope` sees."""
        declared = self._declared.get((scope, name))
        while scope is not self._module and declared is not ast.Global:
            if (scope, name) in self._bindings and declared is not ast.Nonlocal:
                return scope
            scope = self._scope_of(scope)
            declared = self._declared.get((scope, name))
        return self._module

    # --- reads

    def resolve(self, name: ast.Name) -> _Resolution | None:
        """Every value `name` may hold where it is read, or None when one of them is unknown."""
        if self._is_shadowed(name):
            return None
        scope = self._scope_of(name)
        owner = self._owner(scope, name.id)
        bindings = self._bindings.get((owner, name.id), [])
        # a lambda or generator runs when it is called or consumed: any assignment may be in effect by then
        is_deferred = any(isinstance(c, (ast.Lambda, ast.GeneratorExp)) for c in self._shadowing_containers(name))
        candidates = self._reaching(name, bindings) if owner is scope and not is_deferred else bindings
        values = [binding.value for binding in candidates if binding.value is not None]
        if not values or len(values) != len(candidates) or len(values) > MAX_CANDIDATES:
            return None
        return _Resolution(values, self._changes.get((owner, name.id), []))

    def reaching_loop_statement(self, name: ast.Name) -> ast.For | None:
        """The enclosing `for` statement if `name` is bound solely by that loop's target."""
        if self._is_shadowed(name):
            return None
        scope = self._scope_of(name)
        owner = self._owner(scope, name.id)
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
            and (stmt in self._ancestors(self._statement_of(name)) or self._statement_of(name) in stmt.body)
        ):
            return stmt
        return None

    def enclosing_for_loops(self, node: ast.AST) -> list[ast.For]:
        """All `ast.For` loops enclosing `node` across module and function scopes, outermost first."""
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
        read_at = self._statement_of(name)
        enclosing = self._enclosing_blocks(read_at)
        before = sorted((b for b in bindings if _position(b.statement) < _position(read_at)), key=_binding_position)
        latest = next(
            (b for b in reversed(before) if self._blocks.get(self._statement_of(b.statement)) in enclosing), None
        )
        candidates = [b for b in before if latest is None or _position(b.statement) >= _position(latest.statement)]
        loops = [node for node in self._ancestors(read_at) if isinstance(node, LOOPS)]
        candidates += [
            b
            for b in bindings
            if _position(b.statement) >= _position(read_at)
            and any(loop in self._ancestors(b.statement) for loop in loops)
        ]
        return candidates + remote

    def _statement_of(self, node: ast.AST) -> ast.AST:
        while not isinstance(node, ast.stmt) and node in self._parents:
            node = self._parents[node]
        return node

    def _ancestors(self, node: ast.AST) -> list[ast.AST]:
        """Nodes around `node` up to its function or module."""
        ancestors = []
        parent = self._parents.get(node)
        while parent is not None and not isinstance(parent, (*FUNCTIONS, ast.Module)):
            ancestors.append(parent)
            parent = self._parents.get(parent)
        return ancestors

    def _enclosing_blocks(self, statement: ast.AST) -> set[tuple]:
        """The statement lists holding `statement` and each statement around it, up to its scope."""
        blocks = set()
        while statement in self._blocks:
            block = self._blocks[statement]
            blocks.add(block)
            if isinstance(block[0], (*FUNCTIONS, ast.Module)):
                break
            statement = self._statement_of(block[0])  # an except handler or match case: its try / match
        return blocks


def _position(node: ast.AST) -> tuple[int, int]:
    return getattr(node, "lineno", 0), getattr(node, "col_offset", 0)


def _binding_position(binding: _Binding) -> tuple[int, int]:
    return _position(binding.statement)


def _changed_keys(node: ast.expr | None) -> list[ast.expr | None]:
    """Keys a dict literal or dict(k=v) sets; [None] when they cannot be listed."""
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
    return [None]  # popitem(), clear()


def _callee_name(func: ast.expr) -> str | None:
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def _apply_dict_changes(base: _DictValue, changes: list[tuple]) -> _DictValue:
    entries = dict(base.entries)
    opaque = base.opaque
    for key, val in changes:
        if key is OPAQUE:
            entries.clear()
            opaque = True
        else:
            entries.pop(key, None)
            entries[key] = val
    return _DictValue(entries=entries, opaque=opaque)


def _values_equal(left: object, right: object) -> bool:
    if left is UNKNOWN or right is UNKNOWN or left is ABSENT or right is ABSENT:
        return False
    if type(left) is not type(right):
        return False
    if isinstance(left, _DictValue) and isinstance(right, _DictValue):
        if left.opaque != right.opaque or set(left.entries) != set(right.entries):
            return False
        return all(_values_equal(left.entries[k], right.entries[k]) for k in left.entries)
    if isinstance(left, tuple) and isinstance(right, tuple):
        return len(left) == len(right) and all(_values_equal(a, b) for a, b in zip(left, right, strict=True))
    return left == right


def _merge_dict_values(candidates: list[_DictValue]) -> _DictValue:
    if len(candidates) == 1:
        return _DictValue(entries=dict(candidates[0].entries), opaque=candidates[0].opaque)
    keys: list[str] = []
    seen_keys: set[str] = set()
    for cand in candidates:
        for key in cand.entries:
            if key not in seen_keys:
                seen_keys.add(key)
                keys.append(key)
    merged: dict[str, object] = {}
    for key in keys:
        first = candidates[0].entries.get(key, UNKNOWN if candidates[0].opaque else ABSENT)
        agreed = first not in (UNKNOWN, ABSENT) and all(
            _values_equal(
                first,
                cand.entries.get(key, UNKNOWN if cand.opaque else ABSENT),
            )
            for cand in candidates[1:]
        )
        merged[key] = first if agreed else UNKNOWN
    return _DictValue(entries=merged, opaque=any(cand.opaque for cand in candidates))


def _apply_settings_for_merge(settings: list[tuple]) -> tuple[dict[str, object], bool]:
    entries: dict[str, object] = {}
    opaque = False
    for key, val in settings:
        if key is OPAQUE:
            entries.clear()
            opaque = True
        elif isinstance(key, str):
            entries[key] = val
    return entries, opaque


def _merge_settings(alternatives: list[list[tuple]]) -> list[tuple]:
    if len(alternatives) == 1:
        return list(alternatives[0])
    applied = [_apply_settings_for_merge(alt) for alt in alternatives]
    any_opaque = any(op for _, op in applied)
    keys = sorted({k for ent, _ in applied for k in ent})
    out: list[tuple] = [(OPAQUE, None)] if any_opaque else []
    for key in keys:
        first = applied[0][0].get(key, UNKNOWN if applied[0][1] else ABSENT)
        agreed = first not in (UNKNOWN, ABSENT) and all(
            _values_equal(first, ent.get(key, UNKNOWN if op else ABSENT)) for ent, op in applied[1:]
        )
        out.append((key, first if agreed else UNKNOWN))
    return out


class _ScriptReader:
    """Static and parameter-contextual values of a parsed Glue script."""

    def __init__(
        self,
        tree: ast.Module,
        context: ParameterContext | None = None,
        bindings: _Bindings | None = None,
        loop_overrides: Mapping[ast.For, str] | None = None,
    ):
        self._tree = tree
        self._context = context
        self._shared_bindings = bindings
        self._loop_overrides: Mapping[ast.For, str] = loop_overrides or {}
        self._values: LRUCache[ast.Name, object] = LRUCache(maxsize=MEMO_SIZE)
        self._settings: LRUCache[ast.Name, list[tuple]] = LRUCache(maxsize=MEMO_SIZE)
        self._resolving: set[ast.Name] = set()
        self._depth = 0

    @property
    def _names(self) -> _Bindings:
        if self._shared_bindings is None:
            self._shared_bindings = _Bindings(self._tree)
        return self._shared_bindings

    def string(self, node: ast.expr | None) -> str | _Unknown:
        val = self._eval(node)
        return self._scalar_to_str(val)

    def string_list(self, node: ast.expr | None) -> list[str]:
        """Resolved strings from either a scalar string expression or a list/tuple of strings."""
        val = self._eval(node)
        if isinstance(val, str):
            return [val]
        if isinstance(val, tuple):
            out: list[str] = []
            for item in val:
                s = self._scalar_to_str(item)
                if isinstance(s, str):
                    out.append(s)
            return out
        return []

    def sequence(self, node: ast.expr | None) -> list[str] | None:
        """All elements of a bounded constant/derived sequence for `for x in seq:`, or None if unknown."""
        if node is None:
            return None
        if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
            if not (1 <= len(node.elts) <= MAX_LOOP_UNROLLS):
                return None
            items = [self.string(elt) for elt in node.elts]
            return [s for s in items if isinstance(s, str)] if all(isinstance(s, str) for s in items) else None
        if isinstance(node, ast.Name):
            return self._sequence_from_value(self._eval(node))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and not node.keywords:
            return self._sequence_from_call(node, node.func)
        return None

    def _sequence_from_value(self, val: object) -> list[str] | None:
        if isinstance(val, tuple) and 1 <= len(val) <= MAX_LOOP_UNROLLS:
            strs = [self._scalar_to_str(x) for x in val]
            return [s for s in strs if isinstance(s, str)] if all(isinstance(s, str) for s in strs) else None
        if isinstance(val, _DictValue) and not val.opaque and 1 <= len(val.entries) <= MAX_LOOP_UNROLLS:
            return list(val.entries.keys())
        return None

    def _sequence_from_call(self, call: ast.Call, func: ast.Attribute) -> list[str] | None:
        attr = func.attr
        if attr == "split" and len(call.args) <= 2:
            return self._sequence_from_split(func.value, call.args)
        if attr in ("keys", "values") and not call.args:
            d = self._eval(func.value)
            if isinstance(d, _DictValue) and not d.opaque and 1 <= len(d.entries) <= MAX_LOOP_UNROLLS:
                if attr == "keys":
                    return list(d.entries.keys())
                vals = [self._scalar_to_str(v) for v in d.entries.values()]
                return [v for v in vals if isinstance(v, str)] if all(isinstance(v, str) for v in vals) else None
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

    def dict_value(self, node: ast.expr | None) -> _DictValue:
        val = self._eval(node)
        if isinstance(val, _DictValue):
            return val
        return _DictValue(entries={}, opaque=True)

    def settings(self, node: ast.expr | None) -> list[tuple]:
        """Ordered case-insensitive (key, value) settings of a dict expression; [(OPAQUE, None)] when unlisted."""
        if isinstance(node, ast.Name):
            return self._name_settings(node)
        if isinstance(node, ast.Dict):
            return self._dict_literal_settings(node)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "dict":
            return self._dict_call_settings(node)
        d = self.dict_value(node)
        items: list[tuple] = [(OPAQUE, None)] if d.opaque else []
        for key, value in d.entries.items():
            items.append((key.lower(), self._scalar_to_str(value)))
        return items

    def _name_settings(self, node: ast.Name) -> list[tuple]:
        if node in self._settings:
            return self._settings[node]
        if node in self._resolving:
            return [(OPAQUE, None)]
        loop_stmt = self._names.reaching_loop_statement(node)
        if loop_stmt is not None and loop_stmt in self._loop_overrides:
            return [(OPAQUE, None)]
        self._resolving.add(node)
        try:
            resolution = self._names.resolve(node)
            if resolution is None:
                resolved: list[tuple] = [(OPAQUE, None)]
            else:
                merged = _merge_settings([self.settings(value) for value in resolution.values])
                changes = [(OPAQUE, None) if k is OPAQUE else (k.lower(), v) for k, v in resolution.changes]
                resolved = merged + changes
        finally:
            self._resolving.discard(node)
        self._settings[node] = resolved
        return resolved

    def _dict_literal_settings(self, node: ast.Dict) -> list[tuple]:
        out: list[tuple] = []
        for key, value in zip(node.keys, node.values, strict=True):
            if key is None:
                out.extend(self.settings(value))
            else:
                out.append(self.setting(key, value))
        return out

    def _dict_call_settings(self, node: ast.Call) -> list[tuple]:
        out: list[tuple] = []
        for arg in node.args:
            out.extend(self.settings(arg))
        out.extend(self.keyword_settings(node.keywords))
        return out

    def keyword_settings(self, keywords: list[ast.keyword]) -> list[tuple]:
        settings: list[tuple] = []
        for keyword in keywords:
            if keyword.arg is None:  # **options
                settings.extend(self.settings(keyword.value))
            else:
                settings.append((keyword.arg.lower(), self.string(keyword.value)))
        return settings

    def setting(self, key: ast.expr, value: ast.expr) -> tuple:
        key_text = self.string(key)
        return (key_text.lower(), self.string(value)) if isinstance(key_text, str) else (OPAQUE, None)

    @staticmethod
    def _scalar_to_str(val: object) -> str | _Unknown:
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
            if isinstance(node, (ast.List, ast.Tuple)):
                if len(node.elts) > MAX_CANDIDATES * 4:
                    return UNKNOWN
                return tuple(self._eval(elt) for elt in node.elts)
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
        loop_stmt = self._names.reaching_loop_statement(node)
        if loop_stmt is not None and loop_stmt in self._loop_overrides:
            val: object = self._loop_overrides[loop_stmt]
            self._values[node] = val
            return val
        self._resolving.add(node)
        try:
            resolution = self._names.resolve(node)
            if resolution is None:
                val = UNKNOWN
            else:
                candidates = [self._eval(expr) for expr in resolution.values]
                if any(isinstance(c, _DictValue) for c in candidates):
                    dict_cands = [
                        c if isinstance(c, _DictValue) else _DictValue(entries={}, opaque=True) for c in candidates
                    ]
                    merged = _merge_dict_values(dict_cands)
                    val = _apply_dict_changes(merged, resolution.changes) if resolution.changes else merged
                elif resolution.changes:
                    val = UNKNOWN
                else:
                    first = candidates[0]
                    agreed = first is not UNKNOWN and all(_values_equal(first, c) for c in candidates[1:])
                    val = first if agreed else UNKNOWN
        finally:
            self._resolving.discard(node)
        self._values[node] = val
        return val

    def _eval_joined_str(self, node: ast.JoinedStr) -> str | _Unknown:
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
                if part.format_spec is not None:
                    spec = self.string(part.format_spec)
                    if not isinstance(spec, str) or _format_spec_exceeds_bounds(spec):
                        return UNKNOWN
                    try:
                        seg = format(raw, spec)
                    except (ValueError, TypeError):
                        return UNKNOWN
                else:
                    seg = str(raw)
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
            return UNKNOWN
        if isinstance(node.op, ast.Mod):
            left = self._eval(node.left)
            if isinstance(left, str):
                return self._eval_percent_format(left, node.right)
        return UNKNOWN

    @classmethod
    def _percent_scalar(cls, val: object) -> str | int | float | _Unknown:
        if isinstance(val, bool) or cls._scalar_to_str(val) is UNKNOWN:
            return UNKNOWN
        if isinstance(val, (str, int, float)):
            return val
        return UNKNOWN

    def _eval_named_percent_format(self, template: str, named_fields: list[str], rhs_node: ast.expr) -> str | _Unknown:
        if not named_fields or _percent_template_exceeds_bounds(template):
            return UNKNOWN
        d = self._eval(rhs_node)
        if not isinstance(d, _DictValue):
            return UNKNOWN
        resolved_map: dict[str, str | int | float] = {}
        for field_name in named_fields:
            entry = self._percent_scalar(d.entries.get(field_name, UNKNOWN))
            if isinstance(entry, _Unknown):
                return UNKNOWN
            resolved_map[field_name] = entry
        if _percent_star_exceeds_bounds(template, resolved_map.values()):
            return UNKNOWN
        try:
            formatted = template % resolved_map
        except (KeyError, TypeError, ValueError, ZeroDivisionError, OverflowError):
            return UNKNOWN
        return formatted if len(formatted) <= MAX_STRING_LENGTH else UNKNOWN

    def _eval_percent_format(self, template: str, rhs_node: ast.expr) -> str | _Unknown:
        if PERCENT_HUGE_WIDTH_PATTERN.search(template) or _percent_template_exceeds_bounds(template):
            return UNKNOWN
        named_fields = PERCENT_NAMED_FIELD_PATTERN.findall(template)
        if named_fields or "%(" in template:
            return self._eval_named_percent_format(template, named_fields, rhs_node)

        if isinstance(rhs_node, ast.Tuple):
            items = [self._percent_scalar(self._eval(elt)) for elt in rhs_node.elts]
            if any(isinstance(item, _Unknown) for item in items):
                return UNKNOWN
            args_val: object = tuple(items)
        else:
            rhs_val = self._eval(rhs_node)
            if isinstance(rhs_val, tuple):
                items = [self._percent_scalar(x) for x in rhs_val]
                if any(isinstance(x, _Unknown) for x in items):
                    return UNKNOWN
                args_val = tuple(items)
            else:
                scalar = self._percent_scalar(rhs_val)
                if isinstance(scalar, _Unknown):
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

    def _eval_dict_literal(self, node: ast.Dict) -> _DictValue:
        entries: dict[str, object] = {}
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
                key_text = self.string(key)
                if isinstance(key_text, str):
                    entries.pop(key_text, None)
                    entries[key_text] = self._eval(value)
                else:
                    entries.clear()
                    opaque = True
        return _DictValue(entries=entries, opaque=opaque)

    def _eval_dict_call(self, node: ast.Call) -> _DictValue:
        entries: dict[str, object] = {}
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
                if sub.opaque:
                    entries.clear()
                    opaque = True
                for k, v in sub.entries.items():
                    entries.pop(k, None)
                    entries[k] = v
            else:
                entries.pop(keyword.arg, None)
                entries[keyword.arg] = self._eval(keyword.value)
        return _DictValue(entries=entries, opaque=opaque)

    def _eval_subscript(self, node: ast.Subscript) -> object:
        if isinstance(node.slice, ast.Slice):
            return UNKNOWN
        container = self._eval(node.value)
        if isinstance(container, _DictValue):
            key = self.string(node.slice)
            if not isinstance(key, str):
                return UNKNOWN
            return container.entries.get(key, UNKNOWN)
        if isinstance(container, (tuple, str)):
            idx = self._eval(node.slice)
            if isinstance(idx, int) and not isinstance(idx, bool) and -len(container) <= idx < len(container):
                return container[idx]
        return UNKNOWN

    def _eval_call(self, node: ast.Call) -> object:
        if isinstance(node.func, ast.Name) and node.func.id == "dict":
            return self._eval_dict_call(node)
        callee = _callee_name(node.func)
        if callee == "getResolvedOptions":
            return self._eval_resolved_options()
        if callee == "get_workflow_run_properties":
            return self._eval_workflow_run_properties()
        if isinstance(node.func, ast.Attribute):
            attr = node.func.attr
            if attr == "get" and not node.keywords and 1 <= len(node.args) <= 2:
                recv = self._eval(node.func.value)
                if isinstance(recv, _DictValue):
                    key = self.string(node.args[0])
                    if not isinstance(key, str):
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

    def _eval_resolved_options(self) -> _DictValue:
        if self._context is None:
            return _DictValue(entries={}, opaque=True)
        entries: dict[str, object] = {}
        for raw_key, val in self._context.job_args:
            stripped = raw_key.lstrip("-")
            normalized = stripped.replace("-", "_")
            for candidate_key in (raw_key, stripped, normalized):
                if candidate_key:
                    entries[candidate_key] = val
        return _DictValue(entries=entries, opaque=self._context.job_args_opaque)

    def _eval_workflow_run_properties(self) -> _DictValue:
        if self._context is None:
            run_props = _DictValue(entries={}, opaque=True)
        else:
            run_props = _DictValue(entries=dict(self._context.run_props), opaque=self._context.run_props_opaque)
        return _DictValue(entries={"RunProperties": run_props}, opaque=False)

    def _collect_format_args(self, call: ast.Call) -> tuple[list[object], dict[str, object]] | None:
        pos_args: list[object] = []
        for arg in call.args:
            if isinstance(arg, ast.Starred):
                seq = self._eval(arg.value)
                if not isinstance(seq, tuple):
                    return None
                pos_args.extend(seq)
            else:
                pos_args.append(self._eval(arg))

        kw_args: dict[str, object] = {}
        for keyword in call.keywords:
            if keyword.arg is None:
                sub = self.dict_value(keyword.value)
                if sub.opaque:
                    kw_args.clear()
                kw_args.update(sub.entries)
            else:
                kw_args[keyword.arg] = self._eval(keyword.value)
        return pos_args, kw_args

    def _eval_str_format(self, template: str, call: ast.Call) -> str | _Unknown:
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

    def _apply_format_spec(self, raw_val: object, format_spec: str | None, conversion: str | None) -> str | _Unknown:
        if not isinstance(raw_val, (str, int, float, bool)):
            return UNKNOWN
        val: object = str(raw_val) if conversion == "s" else raw_val
        if not format_spec:
            return self._scalar_to_str(val)
        if _format_spec_exceeds_bounds(format_spec):
            return UNKNOWN
        try:
            rendered = format(val, format_spec)
        except (ValueError, TypeError):
            return UNKNOWN
        return rendered if len(rendered) <= MAX_STRING_LENGTH else UNKNOWN

    def _eval_str_method(self, base: str, attr: str, call: ast.Call) -> str | _Unknown:
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
class _ExecutionSlice:
    reader: _ScriptReader
    excluded_loops: frozenset[ast.For]
    active_top_loop: ast.For | None = None


def _is_lineage_io_call(call: ast.Call) -> bool:
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


def _find_loops_with_io(tree: ast.Module, bindings: _Bindings) -> set[ast.For]:
    loops: set[ast.For] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and _is_lineage_io_call(node):
            loops.update(bindings.enclosing_for_loops(node))
    return loops


def _build_execution_slices(
    tree: ast.Module,
    context: ParameterContext | None = None,
    bindings: _Bindings | None = None,
) -> list[_ExecutionSlice]:
    """
    Build per-iteration readers for constant/resolved `for` loops enclosing lineage I/O
    calls without crossing sibling loops. Helper loops without I/O calls are ignored, and
    loops whose iterable is dynamic or exceeds MAX_LOOP_UNROLLS remain unexpanded.
    """
    shared_bindings = bindings or _Bindings(tree)
    base_reader = _ScriptReader(tree, context=context, bindings=shared_bindings)
    loops_with_io = _find_loops_with_io(tree, shared_bindings)

    all_for_nodes = sorted(
        (
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.For) and isinstance(node.target, ast.Name) and node in loops_with_io
        ),
        key=_position,
    )
    if not all_for_nodes:
        return [_ExecutionSlice(reader=base_reader, excluded_loops=frozenset())]

    # Identify outermost unrollable loops (loops not nested inside another unrollable loop)
    top_loops: list[tuple[ast.For, list[str]]] = []
    top_loop_set: set[ast.For] = set()
    for for_node in all_for_nodes:
        enclosing = shared_bindings.enclosing_for_loops(for_node)
        if any(anc in top_loop_set for anc in enclosing):
            continue
        seq = base_reader.sequence(for_node.iter)
        if seq is not None:
            top_loops.append((for_node, seq))
            top_loop_set.add(for_node)

    if not top_loops:
        return [_ExecutionSlice(reader=base_reader, excluded_loops=frozenset())]

    all_top_loops = frozenset(loop for loop, _ in top_loops)
    slices: list[_ExecutionSlice] = []

    for top_loop, top_values in top_loops:
        other_top_loops = all_top_loops - {top_loop}
        loop_slices = _expand_nested_loops(
            tree=tree,
            context=context,
            bindings=shared_bindings,
            current_loop=top_loop,
            current_values=top_values,
            parent_overrides={},
            excluded_loops=other_top_loops,
            loops_with_io=loops_with_io,
            active_top_loop=top_loop,
        )
        slices.extend(loop_slices)
        if len(slices) > MAX_LOOP_UNROLLS:
            return [_ExecutionSlice(reader=base_reader, excluded_loops=frozenset())]

    return slices


def _expand_nested_loops(
    tree: ast.Module,
    context: ParameterContext | None,
    bindings: _Bindings,
    current_loop: ast.For,
    current_values: list[str],
    parent_overrides: dict[ast.For, str],
    excluded_loops: frozenset[ast.For],
    loops_with_io: set[ast.For],
    active_top_loop: ast.For,
) -> list[_ExecutionSlice]:
    direct_child_loops = sorted(
        (
            node
            for node in ast.walk(current_loop)
            if isinstance(node, ast.For)
            and node is not current_loop
            and isinstance(node.target, ast.Name)
            and node in loops_with_io
            and bindings.enclosing_for_loops(node)[-1:] == [current_loop]
        ),
        key=_position,
    )
    out: list[_ExecutionSlice] = []
    for val in current_values:
        overrides = {**parent_overrides, current_loop: val}
        reader = _ScriptReader(tree, context=context, bindings=bindings, loop_overrides=overrides)
        unrollable_children = [
            (child, seq) for child in direct_child_loops if (seq := reader.sequence(child.iter)) is not None
        ]
        if not unrollable_children:
            out.append(_ExecutionSlice(reader=reader, excluded_loops=excluded_loops, active_top_loop=active_top_loop))
        else:
            child_set = frozenset(c for c, _ in unrollable_children)
            for child_loop, child_vals in unrollable_children:
                out.extend(
                    _expand_nested_loops(
                        tree=tree,
                        context=context,
                        bindings=bindings,
                        current_loop=child_loop,
                        current_values=child_vals,
                        parent_overrides=overrides,
                        excluded_loops=excluded_loops | (child_set - {child_loop}),
                        loops_with_io=loops_with_io,
                        active_top_loop=active_top_loop,
                    )
                )
        if len(out) > MAX_LOOP_UNROLLS:
            break
    return out


def _call_in_excluded_loop(call: ast.Call, bindings: _Bindings, excluded_loops: frozenset[ast.For]) -> bool:
    return bool(excluded_loops) and any(loop in excluded_loops for loop in bindings.enclosing_for_loops(call))


def parse_snowflake_refs(
    source_code: str,
    context: ParameterContext | None = None,
) -> tuple[list[SnowflakeRef], list[SnowflakeRef]]:
    """Snowflake (sources, targets) of a Glue script, in source order; none when it does not parse."""
    try:
        return _find_snowflake_refs(ast.parse(source_code), context=context)
    except (SyntaxError, ValueError, RecursionError) as exc:
        # RecursionError: an expression nested deeper than the interpreter's stack, in parsing or in analysis
        logger.debug("Glue script could not be read as Python, skipping Snowflake lineage: %s", exc)
        return [], []


def _find_snowflake_refs(
    tree: ast.Module,
    context: ParameterContext | None = None,
) -> tuple[list[SnowflakeRef], list[SnowflakeRef]]:
    bindings = _Bindings(tree)
    slices = _build_execution_slices(tree, context=context, bindings=bindings)
    fallback = _script_wide_values(tree)
    calls = sorted(
        (node for node in ast.walk(tree) if isinstance(node, ast.Call)),
        key=lambda node: (node.lineno, node.col_offset),
    )
    found: dict[str, list[SnowflakeRef]] = {"sources": [], "targets": []}
    seen_per_call: set[tuple[int, str, SnowflakeRef]] = set()
    for call in calls:
        for slc in slices:
            if _call_in_excluded_loop(call, bindings, slc.excluded_loops):
                continue
            match = _spark_snowflake_call(call, slc.reader) or _glue_snowflake_call(call, slc.reader)
            if match:
                direction, settings = match
                ref = _build_ref(_apply(settings), fallback)
                if ref is not None:
                    key = (id(call), direction, ref)
                    if key not in seen_per_call:
                        seen_per_call.add(key)
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
    direction = SPARK_DIRECTIONS.get((node.attr, call.func.attr)) if isinstance(node, ast.Attribute) else None
    if not direction:
        return None

    spark_format, settings = None, []
    for step in reversed(chain):  # call order
        method = step.func.attr  # type: ignore[union-attr]
        if method == "format" and step.args:
            spark_format = reader.string(step.args[0])
        elif method == "option":
            settings.append(_option_setting(step, reader))
        elif method == "options":
            settings.extend(reader.keyword_settings(step.keywords))
    # load(format="snowflake", dbtable="T") / save(..., **options): applied last
    for keyword in call.keywords:
        if keyword.arg == "format":
            spark_format = reader.string(keyword.value)
    settings.extend(
        reader.keyword_settings([keyword for keyword in call.keywords if keyword.arg not in SPARK_TERMINAL_PARAMETERS])
    )
    is_snowflake = isinstance(spark_format, str) and spark_format.lower() in SNOWFLAKE_FORMATS
    return (direction, settings) if is_snowflake else None


def _option_setting(call: ast.Call, reader: _ScriptReader) -> tuple:
    """`.option("k", "v")` / `.option(key="k", value="v")`; opaque when the key cannot be read."""
    arguments: dict[str, ast.expr] = dict(zip(("key", "value"), call.args, strict=False))
    arguments.update({keyword.arg: keyword.value for keyword in call.keywords if keyword.arg})
    is_readable = set(arguments) == {"key", "value"} and len(call.args) + len(call.keywords) == 2
    return reader.setting(arguments["key"], arguments["value"]) if is_readable else (OPAQUE, None)


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
    elif len(parts) == 1:
        table = parts[0]
    else:  # not a Snowflake table name
        return None
    # an unknown database / schema (a job parameter, say) is left unset rather than taken from the script-wide
    # fallback: the resolver then links the table only when its name is unique.
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


def _script_wide_values(tree: ast.Module) -> dict[str, str]:
    """
    sfDatabase / sfSchema literals anywhere in the script, used for a block that
    does not set the key at all. Only a single distinct value is trusted: with
    several, the block's own value cannot be told apart.
    """
    values: dict[str, set[str]] = {SF_DATABASE: set(), SF_SCHEMA: set()}
    for key, value in _literal_pairs(tree):
        if key and key.lower() in values and value is not None:
            values[key.lower()].add(value)
    return {key: found.pop() for key, found in values.items() if len(found) == 1}


def _literal_pairs(tree: ast.Module) -> Iterator[tuple[str | None, str | None]]:
    """(key, value) string literals of every dict entry, .option() call and keyword argument."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values, strict=True):
                yield _literal_str(key), _literal_str(value)
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute) and node.func.attr == "option" and len(node.args) == 2:
                yield _literal_str(node.args[0]), _literal_str(node.args[1])
            for keyword in node.keywords:
                yield keyword.arg, _literal_str(keyword.value)


def _literal_str(node: ast.expr | None) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None
