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
Column-level lineage of the SQL in a Hex cell.

A Hex SQL cell is a plain SELECT: there is no target table, so the lineage
parser returns no column lineage for it. sqlglot resolves each output column
of the SELECT back to the table columns it reads instead.
"""

import re
from dataclasses import dataclass, field

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError
from sqlglot.lineage import lineage
from sqlglot.optimizer.qualify import qualify
from sqlglot.optimizer.scope import build_scope

from metadata.generated.schema.entity.data.table import Column, DataType, Table

TableKey = tuple[str, str, str]

# Hex runs SQL over dataframes with DuckDB
DATAFRAME_SQL_DIALECT = "duckdb"
# Resolving columns case-insensitively, quoted or not, matches them to the table's
# columns whatever casing the SQL or the warehouse uses: Snowflake's "REGION" is the
# region column OpenMetadata stores, Postgres' "createdAt" its createdAt. Output names
# come out lower-cased as a result, other than quoted aliases.
CASE_INSENSITIVE = sqlglot.Dialect.get_or_raise("duckdb, normalization_strategy=case_insensitive")
JINJA_EXPRESSION = re.compile(r"\{\{.*?\}\}", re.DOTALL)
JINJA_STATEMENT = re.compile(r"\{%.*?%\}", re.DOTALL)
# From an {% elif %} or {% else %} to its {% endif %}: only the first branch is kept
JINJA_OTHER_BRANCHES = re.compile(r"\{%-?\s*(?:elif|else)\b.*?(?=\{%-?\s*endif)", re.DOTALL)
# Marks a table reference to leave unresolved: an upstream cell couldn't resolve it,
# or it names a cell too large to inline
UNRESOLVED = "hex_unresolved"
# A cell inlines every cell it chains to, with theirs, so a notebook where each cell
# joins the ones before it doubles in size per cell. Real cells are a few hundred nodes.
MAX_INLINED_NODES = 10_000
# What a project keeps for its chained cells, all cells together
MAX_STORED_NODES = 100_000


@dataclass
class HexCellColumn:
    name: str
    # The table column it passes straight through, whose type it keeps
    passthrough: Column | None = None
    # (table id, column FQN) of every table column this output column reads
    source_columns: list[tuple[str, str]] = field(default_factory=list)

    @property
    def data_type(self) -> DataType:
        return self.passthrough.dataType if self.passthrough else DataType.UNKNOWN


@dataclass
class HexCellLineage:
    """One SQL cell: the tables it reads and the columns it outputs"""

    # The cell's id, which survives a rename; the label is only displayed
    name: str
    label: str
    sql: str
    # Its SQL could not be read this time: the data model keeps what it had for it
    failed: bool = False
    # table id -> (table, the db service prefix it was found under)
    tables: dict[str, tuple[Table, str | None]] = field(default_factory=dict)
    columns: list[HexCellColumn] = field(default_factory=list)


@dataclass
class OutputColumn:
    name: str
    # (table key, column name) pairs, lower-cased
    sources: set[tuple[TableKey, str]] = field(default_factory=set)
    # Every query on the way to the table selects it as a bare column, so it keeps
    # the type of the column it reads
    passthrough: bool = False


def parse_cell_sql(sql: str, connection_type: str | None) -> exp.Query | None:
    dialect = connection_type.lower() if connection_type else None
    if dialect and sqlglot.Dialect.get(dialect) is None:
        dialect = None
    # Input parameters ({{ start_date }}) are values, never columns, so NULL keeps
    # the query parseable without changing what it reads
    sql = JINJA_STATEMENT.sub("", JINJA_OTHER_BRANCHES.sub("", JINJA_EXPRESSION.sub("NULL", sql)))
    try:
        expression = sqlglot.parse_one(sql, read=dialect)
    except SqlglotError:
        return None
    return expression if isinstance(expression, exp.Query) else None


def get_table_references(expression: exp.Expression) -> list[exp.Table]:
    """
    Tables the query reads, skipping references to a CTE. Scope by scope: a CTE
    defined inside an inlined cell doesn't shadow a table of the same name outside it.
    """
    try:
        root = build_scope(expression)
    except (SqlglotError, IndexError, KeyError):
        root = None
    if root is None:
        cte_names = {cte.alias_or_name.lower() for cte in expression.find_all(exp.CTE)}
        return [
            table
            for table in expression.find_all(exp.Table)
            if table.name and (table.db or table.name.lower() not in cte_names)
        ]
    return [
        table
        for scope in root.traverse()
        for table in scope.tables
        if table.name and isinstance(scope.sources.get(table.alias_or_name), exp.Table)
    ]


def inline_upstream_cells(expression: exp.Query, upstream: dict[str, exp.Query | None]) -> bool:
    """
    Turn the cells this query reads by result variable into CTEs, the way Hex runs
    chained SQL, so their columns trace back to the warehouse. A cell stored as None
    is too large to inline: the references to it are left unresolved. True if the
    query reads any of these cells.
    """
    references = [table for table in get_table_references(expression) if not table.db]
    names = {table.name.lower() for table in references} & upstream.keys()
    if not names:
        return False
    for table in references:
        if table.name.lower() in names and upstream[table.name.lower()] is None:
            table.meta[UNRESOLVED] = True
    # Each cell nests with its own WITH: hoisting its CTEs next to this query's would
    # let a CTE name capture a table this query reads
    ctes = [
        exp.CTE(this=query.copy(), alias=exp.TableAlias(this=exp.to_identifier(name)))
        for name in sorted(names)
        if (query := upstream[name]) is not None
    ]
    if ctes:
        own = expression.args.get("with_")
        expression.set(
            "with_",
            exp.With(
                expressions=ctes + (own.expressions if own else []),
                recursive=own.args.get("recursive") if own else None,
            ),
        )
    return True


def node_count(expression: exp.Expression) -> int:
    return sum(1 for _ in expression.walk())


class ChainedCells:
    """
    The queries of a project's cells so far, by result variable, for the SQL cells
    chained to them. A cell over MAX_INLINED_NODES, or past MAX_STORED_NODES for the
    project, is kept as None: the cells reading it are left unresolved rather than
    reading its name as a warehouse table. A cell whose SQL failed is kept apart: the
    cells reading it can't be built either.
    """

    def __init__(self) -> None:
        self._cells: dict[str, tuple[str | None, exp.Query | None]] = {}
        self._failed: dict[str, str | None] = {}
        self._stored_nodes = 0

    def add(self, name: str, connection_id: str | None, expression: exp.Query) -> None:
        nodes = node_count(expression)
        fits = nodes <= MAX_INLINED_NODES and self._stored_nodes + nodes <= MAX_STORED_NODES
        if fits:
            self._stored_nodes += nodes
        self._cells[name.lower()] = (connection_id, expression.copy() if fits else None)
        self._failed.pop(name.lower(), None)

    def fail(self, name: str, connection_id: str | None) -> None:
        self._failed[name.lower()] = connection_id

    def readable_by(self, connection_id: str | None) -> dict[str, exp.Query | None]:
        """Hex chains a warehouse cell only to cells on its own connection; SQL on dataframes reads any"""
        return {
            name: query
            for name, (cell_connection_id, query) in self._cells.items()
            if not connection_id or cell_connection_id == connection_id
        }

    def failed_readable_by(self, connection_id: str | None) -> set[str]:
        return {
            name
            for name, cell_connection_id in self._failed.items()
            if not connection_id or cell_connection_id == connection_id
        }


def table_key(table: exp.Table) -> TableKey:
    return (table.catalog.lower(), table.db.lower(), table.name.lower())


def get_output_columns(
    expression: exp.Query,
    schema: dict[str, dict[str, dict[str, dict[str, str]]]],
) -> list[OutputColumn]:
    """
    Output columns of the query with the table columns each one reads.

    `schema` is {database: {schema: {table: {column: type}}}} for the tables the
    query reads; it lets `SELECT *` expand and unqualified columns resolve. The
    table references in `expression` must already use those same names.
    """
    _drop_unknown_stars(expression, schema)
    # Qualifying lower-cases every name; a quoted alias keeps the spelling it was given
    quoted_aliases = {
        alias.name.lower(): alias.name
        for select in expression.selects
        if isinstance(alias := select.args.get("alias"), exp.Identifier) and alias.quoted
    }
    try:
        qualified = qualify(
            expression,
            schema=schema or None,
            dialect=CASE_INSENSITIVE,
            validate_qualify_columns=False,
            identify=False,
        )
        scope = build_scope(qualified)
    except (SqlglotError, IndexError, KeyError):
        qualified, scope = expression, None
    if scope is None or not isinstance(qualified, exp.Query):
        # Still list what the query outputs, only without where each column comes from
        return [
            OutputColumn(name=name)
            for name in dict.fromkeys(select.alias_or_name for select in expression.selects)
            if name and name != "*"
        ]

    # Two outputs can share a name (o.id, c.id, or * over a join); suffixing the
    # repeats keeps each one, as lineage() can only tell columns apart by name
    taken: set[str] = set()
    renamed = False
    for select in qualified.selects:
        name = select.alias_or_name
        unique, suffix = name, 1
        while unique in taken:
            suffix += 1
            unique = f"{name}_{suffix}"
        if unique != name and isinstance(select, exp.Alias):
            select.set("alias", exp.to_identifier(unique))
            renamed = True
        taken.add(unique)
    if renamed:
        scope = build_scope(qualified)

    columns: dict[str, OutputColumn] = {}
    for select in qualified.selects:
        name = select.alias_or_name
        if not name or name == "*" or name in columns:
            continue
        column = OutputColumn(name=quoted_aliases.get(name, name))
        try:
            node = lineage(name, qualified, scope=scope, dialect=CASE_INSENSITIVE, trim_selects=False, copy=False)
            nodes = list(node.walk())
            column.sources = {
                # Parsed, not split on dots: a quoted name such as "customer.id" has its own
                (table_key(leaf.source), exp.to_column(leaf.name, dialect=CASE_INSENSITIVE).name.lower())
                for leaf in nodes
                if isinstance(leaf.source, exp.Table)
            }
            column.passthrough = all(
                isinstance(step.expression.unalias(), exp.Column)
                for step in nodes
                if isinstance(step.expression, exp.Alias)
            )
        # sqlglot raises IndexError on a UNION branch selecting * from an unknown table
        except (SqlglotError, IndexError, KeyError):
            pass
        columns[name] = column
    return list(columns.values())


def _drop_unknown_stars(expression: exp.Expression, schema: dict) -> None:
    """
    Drop `t.*` over a table missing from the schema, such as a Python dataframe:
    its columns can't be known, and sqlglot expands no star in a SELECT that has
    one it can't expand, which would hide the columns of the known tables too.
    """
    try:
        root = build_scope(expression)
    except (SqlglotError, IndexError, KeyError):
        return
    # Scope by scope: an alias names different tables in different CTEs
    for scope in root.traverse() if root else []:
        select = scope.expression
        if not isinstance(select, exp.Select):
            continue
        unknown_aliases = {
            alias
            for alias, source in scope.sources.items()
            if isinstance(source, exp.Table) and source.name not in schema.get(source.catalog, {}).get(source.db, {})
        }
        if not unknown_aliases:
            continue
        _spell_out_bare_star(select, unknown_aliases)
        projections = [
            projection
            for projection in select.expressions
            if not (
                isinstance(projection, exp.Column)
                and isinstance(projection.this, exp.Star)
                and projection.table in unknown_aliases
            )
        ]
        if projections:
            select.set("expressions", projections)


def _spell_out_bare_star(select: exp.Select, unknown_aliases: set[str]) -> None:
    """A bare * over a join with an unknown table becomes one t.* per joined table"""
    sources = [select.args.get("from_")] + list(select.args.get("joins") or [])
    aliases = [source.this.alias_or_name for source in sources if source and source.this]
    if not unknown_aliases.intersection(aliases):
        return
    projections: list[exp.Expression] = []
    for projection in select.expressions:
        if isinstance(projection, exp.Star):
            projections.extend(exp.Column(this=exp.Star(), table=exp.to_identifier(alias)) for alias in aliases)
        else:
            projections.append(projection)
    select.set("expressions", projections)
