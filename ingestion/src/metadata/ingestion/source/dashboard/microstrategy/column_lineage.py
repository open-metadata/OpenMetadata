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
Column-level lineage for MicroStrategy cubes.

A cube's SQL names its output columns with aliases MicroStrategy generates (``WJXBFS1``,
``CATEGORY0``), so a data model column is matched on the warehouse columns a projection reads,
never on the alias. ADR:2026-11-05-microstrategy-charts-are-named-by-dossier-and-the-search-is-paged
"""

from __future__ import annotations

import re
import traceback
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import sqlglot
from sqlglot import exp

from metadata.ingestion.lineage.parser import (  # pyright: ignore[reportPrivateUsage]
    LINEAGE_PARSING_TIMEOUT,
    _sqlglot_dialect,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.timeout import timeout

if TYPE_CHECKING:
    from metadata.ingestion.lineage.models import Dialect

logger = ingestion_logger()

# A warehouse column a cube reads: the table as the SQL names it, lowercased and dot-joined
# (``project.dataset.table``), and the column, lowercased.
SourceColumn = tuple[str, str]


@dataclass(frozen=True)
class ParsedCube:
    """What a cube's SQL reads: its tables, and the warehouse columns each projection reads"""

    tables: tuple[str, ...] = ()
    read_columns: frozenset[SourceColumn] = field(default_factory=frozenset)


def table_name_of(table: exp.Table) -> str:
    """``catalog.db.name`` of a table reference, lowercased, without quoting"""
    return ".".join(part for part in (table.catalog, table.db, table.name) if part).lower()


SQL_KEYWORD = re.compile(r"(?:select|with|create|insert|drop|update|delete|merge)\b", re.IGNORECASE)
# MicroStrategy separates the passes of a cube SQL with blank lines, not semicolons.
BLANK_LINES = re.compile(r"\n[ \t\r\f\v]*\n")


def starts_with_sql(text: str) -> bool:
    """
    Whether the text opens with a SQL keyword once leading comments are skipped. A loop, not a
    regex: a repeated comment group in a regex backtracks exponentially on an unclosed ``/*``.
    """
    position, length = 0, len(text)
    while True:
        while position < length and text[position].isspace():
            position += 1
        if text.startswith("--", position):
            newline = text.find("\n", position)
            position = length if newline < 0 else newline + 1
        elif text.startswith("/*", position):
            close = text.find("*/", position + 2)
            if close < 0:
                return False
            position = close + 2
        else:
            return bool(SQL_KEYWORD.match(text, position))


def sql_passes(sql: str) -> list[str]:
    """The passes of a cube SQL. A blank line splits only before a statement, not inside one."""
    passes: list[list[str]] = []
    for chunk in BLANK_LINES.split(sql):
        if passes and not starts_with_sql(chunk):
            passes[-1].append(chunk)
        else:
            passes.append([chunk])
    return ["\n\n".join(chunks) for chunks in passes]


def read_columns(sql: str, dialect: Dialect) -> frozenset[SourceColumn]:
    """
    The (table, column) pairs the projections of every SELECT in the SQL read. A column whose
    table cannot be told is left out, and a pass that does not parse reads nothing: it yields no
    column lineage and leaves table lineage to the lineage parser.
    """
    columns: set[SourceColumn] = set()
    for sql_pass in sql_passes(sql):
        # A cube built from a file answers with a note, not SQL.
        if not starts_with_sql(sql_pass):
            continue
        try:
            statements = timeout(seconds=LINEAGE_PARSING_TIMEOUT)(sqlglot.parse)(
                sql_pass, read=_sqlglot_dialect(dialect)
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not read the columns of a cube SQL pass: %s", exc)
            continue
        for statement in statements:
            for select in statement.find_all(exp.Select) if statement else ():
                columns.update(_select_columns(select))
    return frozenset(columns)


def _select_columns(select: exp.Select) -> set[SourceColumn]:
    tables = {
        (table.alias_or_name or table.name).lower(): table_name_of(table)
        for table in select.find_all(exp.Table)
        if table.find_ancestor(exp.Select) is select
    }
    only_table = next(iter(tables.values())) if len(set(tables.values())) == 1 else None
    columns = set()
    for projection in select.expressions:
        for column in projection.find_all(exp.Column):
            # A nested query is read on its own, against its own aliases.
            if column.find_ancestor(exp.Select) is not select:
                continue
            table = tables.get(column.table.lower()) if column.table else only_table
            if table:
                columns.add((table, column.name.lower()))
    return columns


def normalized(name: str) -> str:
    """
    ``Order Id`` and ``order_id`` alike, for names a Data Import cube derives from columns. Letters
    and digits of every script are kept, so ``数量`` and ``金额`` stay apart.
    """
    return re.sub(r"[\W_]+", "", name.casefold())


def name_match(name: str, columns: set[str], ambiguous: set[str]) -> str | None:
    """
    The one column a Data Import object is named after: the column of the same name, else the only
    column whose normalized name is the object's. None when that is not a single column, or when
    another object of the cube normalizes to the same name.
    """
    exact = {column for column in columns if column.casefold() == name.casefold()}
    if len(exact) == 1:
        return exact.pop()
    key = normalized(name)
    if not key or key in ambiguous:
        return None
    matches = {column for column in columns if normalized(column) == key}
    return matches.pop() if len(matches) == 1 else None


def same_table(sql_table: str, other: str) -> bool:
    """
    Whether two dot-joined table names can be the same table: equal table names, and equal
    qualifiers wherever both name one (``sales.orders`` is ``project-x.sales.orders``).
    """
    left, right = sql_table.lower().split("."), other.lower().split(".")
    return all(a == b for a, b in zip(reversed(left), reversed(right), strict=False))


def table_matches(sql_table: str, table_name: str, schema_name: str | None, database_name: str | None) -> bool:
    """Whether a table the SQL names (``[database.][schema.]table``) is this table"""
    qualified = [database_name, schema_name, table_name] if schema_name else [table_name]
    return same_table(sql_table, ".".join(part for part in qualified if part))
