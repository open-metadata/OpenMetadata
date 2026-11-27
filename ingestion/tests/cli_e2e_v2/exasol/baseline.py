#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Exasol source declarations: the common tables, v1's datatypes table, its view and a join table."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import CHAR, TIMESTAMP, Boolean, Column, Date, Float, Integer, MetaData, String, Table

from ..features.database.common_baseline import (
    COMMON_CUSTOMER_ROWS,
    COMMON_TRANSACTION_ROWS,
    build_common_metadata,
)
from ..features.database.source import SqlSourceBaseline, TableSeed

# v1's fixture names, kept so the mapping to cli_e2e/test_cli_exasol.py stays obvious.
NATIVE_TABLE = "datatypes"
NATIVE_VIEW = "view_datatypes"
JOIN_TABLE = "join_datatypes"
NATIVE_TABLE_DESCRIPTION = "OpenMetadata Exasol CLI table comment"
NATIVE_TABLE_UPDATED_DESCRIPTION = "Updated Exasol datatype fixture."
NATIVE_BOOLEAN_DESCRIPTION = "OpenMetadata Exasol CLI column comment"
NATIVE_UPDATED_DECIMAL_VALUE = 99.25


def _declare_datatypes(metadata: MetaData, name: str, *, comments: bool) -> None:
    """v1's six-column table, with an id so sample rows and mutations are addressable."""
    Table(
        name,
        metadata,
        Column("id", Integer, primary_key=True, nullable=False),
        Column("col_boolean", Boolean, comment=NATIVE_BOOLEAN_DESCRIPTION if comments else None),
        Column("col_decimal", Float),  # Exasol stores every floating type as DOUBLE PRECISION
        Column("col_date", Date),
        Column("col_timestamp", TIMESTAMP),
        Column("col_char", CHAR(1)),
        Column("col_varchar", String(1)),
        comment=NATIVE_TABLE_DESCRIPTION if comments else None,
    )


NATIVE_ROWS: list[dict[str, Any]] = [
    {
        "id": 1,
        "col_boolean": True,
        "col_decimal": 18.5,
        "col_date": date(2023, 7, 13),
        "col_timestamp": datetime(2023, 7, 13, 6, 4, 45),
        "col_char": "a",
        "col_varchar": "b",
    },
    {
        "id": 2,
        "col_boolean": True,
        "col_decimal": -18.5,
        "col_date": date(2023, 9, 13),
        "col_timestamp": datetime(2023, 9, 13, 6, 4, 45),
        "col_char": "c",
        "col_varchar": "d",
    },
]
NATIVE_COLUMN_NAMES: tuple[str, ...] = tuple(NATIVE_ROWS[0])


def build_exasol_baseline(schema: str) -> SqlSourceBaseline:
    """Declare one owned Exasol schema.

    The schema name is left unquoted in hand-written DDL: Exasol folds unquoted
    identifiers to upper case, as `CREATE SCHEMA` and SQLAlchemy's normalised names do.
    """
    metadata = build_common_metadata(schema)
    _declare_datatypes(metadata, NATIVE_TABLE, comments=True)
    # v1's IGNORE_TABLE: the second table of the usage join, and a filter target.
    _declare_datatypes(metadata, JOIN_TABLE, comments=False)
    columns = ", ".join(NATIVE_COLUMN_NAMES)
    return SqlSourceBaseline(
        metadata=metadata,
        seeds=[
            TableSeed("customers", COMMON_CUSTOMER_ROWS),
            TableSeed("transactions", COMMON_TRANSACTION_ROWS),
            TableSeed(NATIVE_TABLE, NATIVE_ROWS),
            TableSeed(JOIN_TABLE, NATIVE_ROWS),
        ],
        ddl=[
            # Columns are projected by name, so the stored view text carries every column edge.
            f"CREATE VIEW {schema}.{NATIVE_VIEW} AS SELECT {columns} FROM {schema}.{NATIVE_TABLE}",
        ],
    )


def usage_join_query(schema: str) -> str:
    """v1's join: the usage workflow must attribute it to both tables and record the column join."""
    return (
        f"SELECT table_source.col_boolean, join_source.col_varchar "
        f"FROM {schema}.{NATIVE_TABLE} AS table_source "
        f"JOIN {schema}.{JOIN_TABLE} AS join_source ON table_source.col_boolean = join_source.col_boolean"
    )
