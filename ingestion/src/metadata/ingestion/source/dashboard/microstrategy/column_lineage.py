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


SQL_START = r"\s*(?:select|with|create|insert|drop|update|delete|merge)\b"
# MicroStrategy separates the passes of a cube SQL with blank lines, not semicolons.
PASS_BOUNDARY = re.compile(rf"\n\s*\n(?={SQL_START})", re.IGNORECASE)


def read_columns(sql: str, dialect: Dialect) -> frozenset[SourceColumn]:
    """
    The (table, column) pairs the projections of every SELECT in the SQL read. A column whose
    table cannot be told is left out, and a pass that does not parse reads nothing: it yields no
    column lineage and leaves table lineage to the lineage parser.
    """
    columns: set[SourceColumn] = set()
    for sql_pass in PASS_BOUNDARY.split(sql):
        # A cube built from a file answers with a note, not SQL.
        if not re.match(SQL_START, sql_pass, re.IGNORECASE):
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
            table = tables.get(column.table.lower()) if column.table else only_table
            if table:
                columns.add((table, column.name.lower()))
    return columns


def normalized(name: str) -> str:
    """``Order Id`` and ``order_id`` alike, for names a Data Import cube derives from columns"""
    return re.sub(r"[^a-z0-9]", "", name.lower())


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
