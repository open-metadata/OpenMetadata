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
are case-insensitive. A value is resolved when it is a literal or a name bound
to one by plain assignments that agree on it (see _Bindings); anything else (a
function parameter, an f-string, args["X"], a dict built at runtime) is unknown.
A ref needs a known table. An unknown database or schema is left unset, and the
resolver links the table only when its name matches a single table.

Only Python scripts are read: a Scala Glue job does not parse as Python and
gets no Snowflake lineage from its script.
"""

import ast
import re
from collections.abc import Iterator
from dataclasses import dataclass, replace
from functools import cached_property

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

# Snowflake identifiers: "ORDERS.V2" is one quoted name, FINANCE.CURATED.ORDERS are three
QUALIFIED_NAME_PART_PATTERN = re.compile(r'"[^"]*"|[^.]+')


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
# names whose resolved value is kept per script
MEMO_SIZE = 1024


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

    A name is local to a function that binds it (unless declared global), and is
    otherwise looked up in enclosing functions, then the module. Lambda
    parameters, comprehension variables and class attributes are only visible
    inside, and a read of one of them is unknown. Only `name = value` assignments
    have a value: a parameter, loop target, import or other binding is unknown.

    For a read in the scope of its assignments, the candidates are the latest
    assignment before it in an enclosing block plus any later one in a branch
    before the read (if/else, try/except), and any after it in a loop around the
    read. A read from a nested function may run after any assignment, so all of
    them are candidates, as for a read in a lambda or generator expression,
    which runs later than where it is written. The reader merges candidates key by key: a key every
    candidate sets to the same value is known.

    An assignment made from another function (global / nonlocal) may run at any
    point, so it is always a candidate.

    An in-place change (d["k"] = v, d.update(...), d |= {...}, d.pop(k)) makes
    the changed keys unknown wherever the dict is read, and wherever a dict it
    was assigned from (opts = sf_options) is read; a key that cannot be read
    makes the whole dict unknown. Not modelled: class-body ordering, a dict
    changed by a function it is passed to or stored on an object.
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
                (text.lower(), UNKNOWN) if (text := _literal_str(key)) else (OPAQUE, None) for key in keys
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


class _ScriptReader:
    """Static values of a parsed script: strings and option settings."""

    def __init__(self, tree: ast.Module):
        self._tree = tree
        # values of names already resolved, so a name read by many calls is resolved once
        self._strings: LRUCache[ast.Name, str | _Unknown] = LRUCache(maxsize=MEMO_SIZE)
        self._settings: LRUCache[ast.Name, list[tuple]] = LRUCache(maxsize=MEMO_SIZE)
        self._resolving: set[ast.Name] = set()  # a name defined through itself is unknown

    @cached_property
    def _names(self) -> _Bindings:
        """Indexed on first use: most scripts have no Snowflake call to resolve names for."""
        return _Bindings(self._tree)

    def string(self, node: ast.expr | None) -> str | _Unknown:
        if isinstance(node, ast.Constant) and isinstance(node.value, (str, int, float, bool)):
            return str(node.value)
        if not isinstance(node, ast.Name):
            return UNKNOWN
        if node in self._strings:
            return self._strings[node]
        if node in self._resolving:
            return UNKNOWN
        self._resolving.add(node)
        try:
            resolution = self._names.resolve(node)
            values = {self.string(value) for value in resolution.values} if resolution else {UNKNOWN}
        finally:
            self._resolving.discard(node)
        value = values.pop() if len(values) == 1 else UNKNOWN
        self._strings[node] = value
        return value

    def settings(self, node: ast.expr | None) -> list[tuple]:
        """Ordered (key, value) settings of a dict expression; [(OPAQUE, None)] when unlisted."""
        if isinstance(node, ast.Name):
            return self._name_settings(node)
        if isinstance(node, ast.Dict):
            return self._dict_literal_settings(node)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "dict":
            return self._dict_call_settings(node)
        return [(OPAQUE, None)]

    def _name_settings(self, node: ast.Name) -> list[tuple]:
        if node in self._settings:
            return self._settings[node]
        if node in self._resolving:
            return [(OPAQUE, None)]
        self._resolving.add(node)
        try:
            resolution = self._names.resolve(node)
            settings = [(OPAQUE, None)]
            if resolution:
                settings = _merge([self.settings(value) for value in resolution.values]) + resolution.changes
        finally:
            self._resolving.discard(node)
        self._settings[node] = settings
        return settings

    def _dict_literal_settings(self, node: ast.Dict) -> list[tuple]:
        settings = []
        for key, value in zip(node.keys, node.values, strict=True):
            if key is None:  # {**base, ...}
                settings.extend(self.settings(value))
            else:
                settings.append(self.setting(key, value))
        return settings

    def _dict_call_settings(self, node: ast.Call) -> list[tuple]:
        settings = []
        for arg in node.args:  # dict(base, ...)
            settings.extend(self.settings(arg))
        settings.extend(self.keyword_settings(node.keywords))
        return settings

    def keyword_settings(self, keywords: list[ast.keyword]) -> list[tuple]:
        settings = []
        for keyword in keywords:
            if keyword.arg is None:  # **options
                settings.extend(self.settings(keyword.value))
            else:
                settings.append((keyword.arg.lower(), self.string(keyword.value)))
        return settings

    def setting(self, key: ast.expr, value: ast.expr) -> tuple:
        key_text = self.string(key)
        return (key_text.lower(), self.string(value)) if isinstance(key_text, str) else (OPAQUE, None)


def _merge(alternatives: list[list[tuple]]) -> list[tuple]:
    """One dict that may be any of `alternatives`: a key keeps a value only when all of them agree on it."""
    if len(alternatives) == 1:
        return alternatives[0]
    applied = [_apply(settings) for settings in alternatives]
    keys = sorted(set().union(*applied))
    return [
        (key, values.pop() if len(values := {options.get(key, ABSENT) for options in applied}) == 1 else UNKNOWN)
        for key in keys
    ]


def parse_snowflake_refs(source_code: str) -> tuple[list[SnowflakeRef], list[SnowflakeRef]]:
    """Snowflake (sources, targets) of a Glue script, in source order; none when it does not parse."""
    try:
        return _find_snowflake_refs(ast.parse(source_code))
    except (SyntaxError, ValueError, RecursionError) as exc:
        # RecursionError: an expression nested deeper than the interpreter's stack, in parsing or in analysis
        logger.debug("Glue script could not be read as Python, skipping Snowflake lineage: %s", exc)
        return [], []


def _find_snowflake_refs(tree: ast.Module) -> tuple[list[SnowflakeRef], list[SnowflakeRef]]:
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
    direction = SPARK_DIRECTIONS.get((node.attr, call.func.attr)) if isinstance(node, ast.Attribute) else None
    if not direction:
        return None

    spark_format, settings = None, []
    for step in reversed(chain):  # call order
        method = step.func.attr
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
