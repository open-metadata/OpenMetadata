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
bound to one by a plain assignment that is certain to be the one in effect
(see _Bindings): anything else (a function parameter, an f-string, args["X"],
a dict built at runtime) is unknown, and a ref is only produced when the table,
and the schema when one is set, are known.

Only Python scripts are read: a Scala Glue job does not parse as Python and
gets no Snowflake lineage from its script.
"""

import ast
import re
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
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
# load() / save() parameters that are not connector options; any other keyword is one
SPARK_TERMINAL_PARAMETERS = {"path", "format", "schema", "mode", "partitionBy"}

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


# nodes other than the module that open a scope; comprehensions open one too
SCOPE_NODES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)
COMPREHENSIONS = (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
LOOPS = (ast.For, ast.AsyncFor, ast.While)


@dataclass(frozen=True)
class _Assignment:
    """A plain `name = value` statement."""

    value: ast.expr
    statement: ast.stmt


# a binding whose value is not statically known: parameter, loop target, import, del...
_Binding = _Assignment | None


class _Scope:
    def __init__(self, node: ast.AST, parent: "_Scope | None"):
        self.node = node
        self.parent = parent
        self.bindings: dict[str, list[_Binding]] = {}
        self.declarations: dict[str, type] = {}  # name -> ast.Global / ast.Nonlocal
        self.changed: set[str] = set()  # names whose dict is changed in place


class _ScopeBuilder(ast.NodeVisitor):
    """Every binding, declaration, in-place change and read of a name, in the scope Python evaluates it in."""

    def __init__(self, tree: ast.Module):
        self.module = _Scope(tree, None)
        self.reads: dict[ast.Name, _Scope] = {}
        self.events: list[tuple[_Scope, str, _Binding]] = []
        self.changes: list[tuple[_Scope, str]] = []
        self._scope = self.module
        self.visit(tree)

    @contextmanager
    def _entering(self, node: ast.AST):
        outer, self._scope = self._scope, _Scope(node, self._scope)
        try:
            yield
        finally:
            self._scope = outer

    def _visit_all(self, nodes: Iterable[ast.AST | None]) -> None:
        for node in nodes:
            if node is not None:
                self.visit(node)

    def _bind(self, name: str, binding: _Binding = None, scope: _Scope | None = None) -> None:
        self.events.append((scope or self._scope, name, binding))

    def _change(self, node: ast.expr) -> None:
        while isinstance(node, (ast.Subscript, ast.Attribute)):
            node = node.value
        if isinstance(node, ast.Name):
            self.changes.append((self._scope, node.id))

    def _bind_arguments(self, arguments: ast.arguments) -> None:
        for argument in (*arguments.posonlyargs, *arguments.args, *arguments.kwonlyargs):
            self._bind(argument.arg)
        for argument in (arguments.vararg, arguments.kwarg):
            if argument:
                self._bind(argument.arg)

    # defaults and decorators run in the enclosing scope; the body in its own
    def visit_FunctionDef(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        self._bind(node.name)
        self._visit_all([*node.decorator_list, *node.args.defaults, *node.args.kw_defaults])
        with self._entering(node):
            self._bind_arguments(node.args)
            self._visit_all(node.body)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.visit_FunctionDef(node)

    def visit_Lambda(self, node: ast.Lambda) -> None:
        self._visit_all([*node.args.defaults, *node.args.kw_defaults])
        with self._entering(node):
            self._bind_arguments(node.args)
            self.visit(node.body)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self._bind(node.name)
        self._visit_all([*node.decorator_list, *node.bases, *node.keywords])
        with self._entering(node):
            self._visit_all(node.body)

    # the first iterable runs in the enclosing scope; targets are local to the comprehension
    def _visit_comprehension(self, node: ast.ListComp | ast.SetComp | ast.DictComp | ast.GeneratorExp) -> None:
        first, *rest = node.generators
        self.visit(first.iter)
        with self._entering(node):
            self._visit_all([first.target, *first.ifs, *rest])
            self._visit_all([getattr(node, field, None) for field in ("elt", "key", "value")])

    def visit_ListComp(self, node: ast.ListComp) -> None:
        self._visit_comprehension(node)

    def visit_SetComp(self, node: ast.SetComp) -> None:
        self._visit_comprehension(node)

    def visit_DictComp(self, node: ast.DictComp) -> None:
        self._visit_comprehension(node)

    def visit_GeneratorExp(self, node: ast.GeneratorExp) -> None:
        self._visit_comprehension(node)

    def visit_Global(self, node: ast.Global) -> None:
        self._scope.declarations.update(dict.fromkeys(node.names, ast.Global))

    def visit_Nonlocal(self, node: ast.Nonlocal) -> None:
        self._scope.declarations.update(dict.fromkeys(node.names, ast.Nonlocal))

    def visit_Assign(self, node: ast.Assign) -> None:
        for target in node.targets:
            if isinstance(target, ast.Name):
                self._bind(target.id, _Assignment(node.value, node))
            else:
                self.visit(target)
        self.visit(node.value)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        if isinstance(node.target, ast.Name) and node.value is not None:
            self._bind(node.target.id, _Assignment(node.value, node))
        else:
            self.visit(node.target)
        self._visit_all([node.annotation, node.value])

    def visit_NamedExpr(self, node: ast.NamedExpr) -> None:
        scope = self._scope  # a walrus in a comprehension binds in the scope around it
        while isinstance(scope.node, COMPREHENSIONS) and scope.parent:
            scope = scope.parent
        self._bind(node.target.id, scope=scope)
        self.visit(node.value)

    def visit_Name(self, node: ast.Name) -> None:
        if isinstance(node.ctx, ast.Load):
            self.reads[node] = self._scope
        else:  # for / with targets, unpacking, augmented assignment, del
            self._bind(node.id)

    def visit_Subscript(self, node: ast.Subscript | ast.Attribute) -> None:
        if not isinstance(node.ctx, ast.Load):  # d["k"] = v, del d["k"], d["k"] += v
            self._change(node.value)
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        self.visit_Subscript(node)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Attribute) and node.func.attr in MUTATING_METHODS:  # d.update(...)
            self._change(node.func.value)
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import | ast.ImportFrom) -> None:
        for alias in node.names:
            if alias.name != "*":
                self._bind(alias.asname or alias.name.split(".")[0])

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        self.visit_Import(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        if node.name:
            self._bind(node.name)
        self.generic_visit(node)

    def visit_MatchAs(self, node: ast.MatchAs | ast.MatchStar) -> None:
        if node.name:
            self._bind(node.name)
        self.generic_visit(node)

    def visit_MatchStar(self, node: ast.MatchStar) -> None:
        self.visit_MatchAs(node)

    def visit_MatchMapping(self, node: ast.MatchMapping) -> None:
        if node.rest:
            self._bind(node.rest)
        self.generic_visit(node)


class _Bindings:
    """
    The value a name holds where it is read, following Python's scoping: a name
    bound in a function is local to it (unless declared global / nonlocal), a
    class body is not visible to its methods, and a parameter, loop target,
    import, comprehension variable or walrus binds only in its own scope.

    The read resolves to the value of a plain `name = value` statement when:
    - it is the only binding of the name in the scope the read sees, wherever it
      sits (in a branch, a loop or a later line, it is still the only value); or
    - it has several, all plain, the read is in that same scope, no binding is
      under a loop, and every binding before the read sits in a block enclosing
      it (so `if`/`else` branches or an `if` body read after the `if` are
      unknown): the latest one wins.
    A global with several bindings read from inside a function is unknown, since
    its value depends on when the function is called. A dict changed in place
    (d["k"] = v, d.update(...), d |= ...) is unknown in the scope it belongs to;
    a dict handed to a function that changes it is not tracked.
    """

    def __init__(self, tree: ast.Module):
        builder = _ScopeBuilder(tree)
        self._reads = builder.reads
        self._parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
        self._blocks = {
            statement: (node, field)
            for node in ast.walk(tree)
            for field, value in ast.iter_fields(node)
            if isinstance(value, list)
            for statement in value
            if isinstance(statement, ast.stmt)
        }
        self._module = builder.module
        # nonlocal bindings last: they belong to the binding of an enclosing function
        for scope, name, binding in sorted(
            builder.events, key=lambda event: event[0].declarations.get(event[1]) is ast.Nonlocal
        ):
            self._binding_owner(scope, name).bindings.setdefault(name, []).append(binding)
        for scope, name in builder.changes:
            self._owner(scope, name).changed.add(name)

    def _binding_owner(self, scope: _Scope, name: str) -> _Scope:
        declaration = scope.declarations.get(name)
        if declaration is ast.Global:
            return self._module
        if declaration is ast.Nonlocal:
            return self._enclosing_owner(scope.parent or self._module, name)
        return scope

    def _owner(self, scope: _Scope, name: str) -> _Scope:
        """The scope whose bindings of `name` a read in `scope` sees."""
        declaration = scope.declarations.get(name)
        if declaration is ast.Global or scope.parent is None:
            return self._module
        if declaration is None and name in scope.bindings:
            return scope
        return self._enclosing_owner(scope.parent, name)

    @staticmethod
    def _enclosing_owner(scope: _Scope, name: str) -> _Scope:
        """The nearest enclosing function binding `name`, else the module; class bodies are skipped."""
        while scope.parent is not None:
            if not isinstance(scope.node, ast.ClassDef) and name in scope.bindings:
                return scope
            scope = scope.parent
        return scope

    def resolve(self, name: ast.Name) -> ast.expr | None:
        scope = self._reads.get(name)
        if scope is None:
            return None
        owner = self._owner(scope, name.id)
        bindings = owner.bindings.get(name.id, [])
        assignments = [binding for binding in bindings if binding is not None]
        if not assignments or len(assignments) != len(bindings) or name.id in owner.changed:
            return None
        if len(assignments) == 1:
            return assignments[0].value
        return self._reaching(name, assignments) if owner is scope else None

    def _reaching(self, name: ast.Name, assignments: list[_Assignment]) -> ast.expr | None:
        """The latest assignment before the read, when no other one could have run in between."""
        if any(self._in_loop(assignment.statement) for assignment in assignments):
            return None
        read_at = self._statement_of(name)
        enclosing = self._enclosing_blocks(read_at)
        reaching = None
        for assignment in sorted(assignments, key=lambda assignment: _position(assignment.statement)):
            if _position(assignment.statement) >= _position(read_at):
                break
            if self._blocks.get(assignment.statement) not in enclosing:
                return None
            reaching = assignment
        return reaching.value if reaching else None

    def _statement_of(self, node: ast.AST) -> ast.stmt:
        while not isinstance(node, ast.stmt):
            node = self._parents[node]
        return node

    def _enclosing_blocks(self, statement: ast.stmt) -> set[tuple]:
        """The statement lists holding `statement` and each statement around it, up to its scope."""
        blocks = set()
        while statement in self._blocks:
            block = self._blocks[statement]
            blocks.add(block)
            if isinstance(block[0], (ast.Module, *SCOPE_NODES)):
                break
            statement = self._statement_of(block[0])  # an except handler or match case: its try / match
        return blocks

    def _in_loop(self, statement: ast.stmt) -> bool:
        node = self._parents.get(statement)
        while node is not None and not isinstance(node, (ast.Module, *SCOPE_NODES)):
            if isinstance(node, LOOPS):
                return True
            node = self._parents.get(node)
        return False


def _position(statement: ast.stmt) -> tuple[int, int]:
    return statement.lineno, statement.col_offset


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
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "dict":
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
        return (key_text.lower(), self.string(value)) if isinstance(key_text, str) else (OPAQUE, None)


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
            is_positional = len(step.args) == 2 and not step.keywords
            settings.append(reader.setting(*step.args) if is_positional else (OPAQUE, None))
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
    # an unknown schema must not fall back to a guess: linking another schema's table is worse than none
    if schema is UNKNOWN:
        return None
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
