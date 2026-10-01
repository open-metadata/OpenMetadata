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
"""Expected persisted catalog derived from authored Snowflake declarations and an independent type map."""

from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

import snowflake.sqlalchemy as sf
from sqlalchemy import (
    BINARY,
    CHAR,
    BigInteger,
    DateTime,
    Float,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType

from ..features.database.catalog.derive import derive_expected_tables
from ..features.database.catalog.type_map import CORE_TYPE_MAP, TypeMap
from ..features.database.catalog.types import (
    ExpectedColumn,
    ExpectedDatabase,
    ExpectedSchema,
    ExpectedService,
    ExpectedStoredProcedure,
    ExpectedTable,
)
from .baseline import build_snowflake_baseline

if TYPE_CHECKING:
    from collections.abc import Collection, Iterable

SNOWFLAKE_TYPE_MAP: TypeMap = {
    **CORE_TYPE_MAP,
    # Snowflake stores every integer as NUMBER(38, 0) and every fixed-point type as NUMBER(p, s).
    # NUMBER, DECIMAL and NUMERIC are synonyms there, and ingestion has always stored them as DECIMAL.
    Integer: DataType.DECIMAL,
    BigInteger: DataType.DECIMAL,
    SmallInteger: DataType.DECIMAL,
    Numeric: DataType.DECIMAL,
    Float: DataType.FLOAT,
    # CHAR(n), TEXT and STRING are VARCHAR synonyms, and Snowflake reports them as VARCHAR(n).
    String: DataType.VARCHAR,
    Text: DataType.VARCHAR,
    CHAR: DataType.VARCHAR,
    # DATETIME is TIMESTAMP_NTZ. Every TIMESTAMP variant is TIMESTAMP, as the type parser declares for Snowflake.
    DateTime: DataType.TIMESTAMP,
    sf.TIMESTAMP_NTZ: DataType.TIMESTAMP,
    sf.TIMESTAMP_LTZ: DataType.TIMESTAMP,
    sf.TIMESTAMP_TZ: DataType.TIMESTAMP,
    BINARY: DataType.BINARY,
    # Semi-structured VARIANT and OBJECT hold JSON documents.
    sf.VARIANT: DataType.JSON,
    sf.OBJECT: DataType.JSON,
    sf.ARRAY: DataType.ARRAY,
    sf.GEOGRAPHY: DataType.GEOGRAPHY,
}

STORED_PROCEDURES = ("SP_ACTIVE_CUSTOMER_COUNT", "FN_CONVERT_AMOUNT")


def stored_name(name: str) -> str:
    """Snowflake folds unquoted identifiers to upper case, and the declarations are lower-case."""
    return name.upper()


def _fold(table: ExpectedTable) -> ExpectedTable:
    return replace(
        table,
        name=stored_name(table.name),
        columns=[replace(column, name=stored_name(column.name)) for column in table.columns],
    )


def _customer_txn_summary_view() -> ExpectedTable:
    """Hand-authored view columns: ``COUNT`` and ``COALESCE(SUM(NUMBER), 0)`` are NUMBER, ingested as DECIMAL."""
    return ExpectedTable(
        name="CUSTOMER_TXN_SUMMARY",
        table_type=TableType.View,
        columns=[
            ExpectedColumn("CUSTOMER_ID", DataType.DECIMAL),
            ExpectedColumn("FULL_NAME", DataType.VARCHAR),
            ExpectedColumn("CUSTOMER_STATUS", DataType.VARCHAR),
            ExpectedColumn("TXN_COUNT", DataType.DECIMAL),
            ExpectedColumn("TOTAL_AMOUNT", DataType.DECIMAL),
        ],
    )


def snowflake_schema(
    database: str,
    schema: str,
    *,
    tables: Collection[str] | None = None,
    procedures: bool = False,
    extra: Iterable[ExpectedTable] = (),
) -> ExpectedSchema:
    """Return one owned schema subtree.

    ``tables`` narrows it for complete-inventory filters, ``procedures`` adds the
    routines (only shim-backed runs ingest them), and ``extra`` appends feature tables.
    """
    expected = [
        _fold(table)
        for table in derive_expected_tables(build_snowflake_baseline(database, schema).metadata, SNOWFLAKE_TYPE_MAP)
    ]
    expected.append(_customer_txn_summary_view())
    expected.extend(extra)
    if tables is not None:
        kept = set(tables)
        expected = [table for table in expected if table.name in kept]
    routines = [ExpectedStoredProcedure(name=name) for name in STORED_PROCEDURES] if procedures else []
    return ExpectedSchema(schema, expected, stored_procedures=routines)


def snowflake_expected(service_name: str, database: str, *schemas: ExpectedSchema) -> ExpectedService:
    return ExpectedService(
        name=service_name,
        service_type=DatabaseServiceType.Snowflake,
        databases=[ExpectedDatabase(database, list(schemas))],
    )
