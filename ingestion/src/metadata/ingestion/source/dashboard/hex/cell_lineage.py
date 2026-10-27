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
# Resolving columns case-insensitively, quoted or not, matches them to the table's
# columns whatever casing the SQL or the warehouse uses: Snowflake's "REGION" is the
# region column OpenMetadata stores, Postgres' "createdAt" its createdAt. Output names
# come out lower-cased as a result, other than quoted aliases.
CASE_INSENSITIVE = sqlglot.Dialect.get_or_raise("duckdb, normalization_strategy=case_insensitive")
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
                (table_key(leaf.source), leaf.name.split(".")[-1].strip('"`').lower())
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
