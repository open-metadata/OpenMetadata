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

from metadata.generated.schema.entity.data.table import DataType, Table

TableKey = tuple[str, str, str]

# Hex runs SQL over dataframes with DuckDB
DATAFRAME_SQL_DIALECT = "duckdb"
JINJA_EXPRESSION = re.compile(r"\{\{.*?\}\}", re.DOTALL)
JINJA_STATEMENT = re.compile(r"\{%.*?%\}", re.DOTALL)


@dataclass
class HexCellColumn:
    name: str
    data_type: DataType
    # (table id, column FQN) of every table column this output column reads
    source_columns: list[tuple[str, str]] = field(default_factory=list)


@dataclass
class HexCellLineage:
    """One SQL cell: the tables it reads and the columns it outputs"""

    name: str
    sql: str
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
    sql = JINJA_STATEMENT.sub("", JINJA_EXPRESSION.sub("NULL", sql))
    try:
        expression = sqlglot.parse_one(sql, read=dialect)
    except SqlglotError:
        return None
    return expression if isinstance(expression, exp.Query) else None


def get_table_references(expression: exp.Expression) -> list[exp.Table]:
    """Tables read by the query, skipping references to its own CTEs"""
    cte_names = {cte.alias_or_name.lower() for cte in expression.find_all(exp.CTE)}
    return [
        table
        for table in expression.find_all(exp.Table)
        if table.name and (table.db or table.name.lower() not in cte_names)
    ]


def inline_upstream_cells(expression: exp.Query, upstream: dict[str, exp.Query]) -> bool:
    """
    Turn the cells this query reads by result variable into CTEs, the way Hex runs
    chained SQL, so their columns trace back to the warehouse. True if any was inlined.
    """
    names = {table.name.lower() for table in get_table_references(expression) if not table.db} & upstream.keys()
    if not names:
        return False
    ctes: list[exp.Expression] = []
    for name in sorted(names):
        query = upstream[name].copy()
        # Hoist the upstream cell's own CTEs so the WITH stays flat
        inner = query.args.get("with_")
        query.set("with_", None)
        ctes.extend(inner.expressions if inner else [])
        ctes.append(exp.CTE(this=query, alias=exp.TableAlias(this=exp.to_identifier(name))))
    own = expression.args.get("with_")
    expression.set("with_", exp.With(expressions=ctes + (own.expressions if own else [])))
    return True


def table_key(table: exp.Table) -> TableKey:
    return (table.catalog.lower(), table.db.lower(), table.name.lower())


def get_output_columns(
    expression: exp.Expression,
    schema: dict[str, dict[str, dict[str, dict[str, str]]]],
) -> list[OutputColumn]:
    """
    Output columns of the query with the table columns each one reads.

    `schema` is {database: {schema: {table: {column: type}}}} for the tables the
    query reads; it lets `SELECT *` expand and unqualified columns resolve. The
    table references in `expression` must already use those same names.
    """
    _drop_unknown_stars(expression, schema)
    # Qualifying with the default dialect lower-cases unquoted identifiers, so names
    # line up with the schema and with each other whatever the warehouse's casing.
    expression = qualify(expression, schema=schema or None, validate_qualify_columns=False, identify=False)
    scope = build_scope(expression)
    if scope is None or not isinstance(expression, exp.Query):
        return []

    columns: dict[str, OutputColumn] = {}
    for select in expression.selects:
        name = select.alias_or_name
        if not name or name == "*" or name in columns:
            continue
        column = OutputColumn(name=name)
        # The identifier keeps a quoted alias' case; lineage() lower-cases a plain string
        alias = select.args.get("alias")
        target = exp.Column(this=alias.copy()) if isinstance(alias, exp.Identifier) else name
        try:
            node = lineage(target, expression, scope=scope, trim_selects=False, copy=False)
            nodes = list(node.walk())
            column.sources = {
                (table_key(leaf.source), leaf.name.split(".")[-1].lower())
                for leaf in nodes
                if isinstance(leaf.source, exp.Table)
            }
            column.passthrough = all(
                isinstance(step.expression.unalias(), exp.Column)
                for step in nodes
                if isinstance(step.expression, exp.Alias)
            )
        except SqlglotError:
            pass
        columns[name] = column
    return list(columns.values())


def _drop_unknown_stars(expression: exp.Expression, schema: dict) -> None:
    """
    Drop `t.*` over a table missing from the schema, such as a Python dataframe:
    its columns can't be known, and sqlglot expands no star in a SELECT that has
    one it can't expand, which would hide the columns of the known tables too.
    """
    unknown_aliases = {
        table.alias_or_name
        for table in get_table_references(expression)
        if table.name not in schema.get(table.catalog, {}).get(table.db, {})
    }
    for select in expression.find_all(exp.Select):
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
