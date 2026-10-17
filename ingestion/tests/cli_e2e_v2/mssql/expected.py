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
"""Authored MSSQL catalog expectations, independent of connector parsers."""

from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from sqlalchemy import BINARY, Boolean, Numeric, Text
from sqlalchemy.dialects import mssql

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType

from ..features.database.catalog.derive import derive_expected_service, derive_expected_tables
from ..features.database.catalog.type_map import CORE_TYPE_MAP, TypeMap
from ..features.database.catalog.types import ExpectedService, ExpectedStoredProcedure, ExpectedTable
from .baseline import (
    ACTIVE_CUSTOMER_PROCEDURE,
    ACTIVE_CUSTOMER_PROCEDURE_DESCRIPTION,
    NATIVE_INTEGER_COLUMN,
    NATIVE_INTEGER_DESCRIPTION,
    NATIVE_TABLE,
    NATIVE_TABLE_DESCRIPTION,
    NATIVE_VIEW,
    build_mssql_baseline,
)

if TYPE_CHECKING:
    from collections.abc import Collection
    from datetime import date

MSSQL_TYPE_MAP: TypeMap = {
    **CORE_TYPE_MAP,
    # SQL Server renders the portable types as its own, and ingestion reports those.
    Boolean: DataType.BIT,  # rendered BIT
    Text: DataType.VARCHAR,  # rendered VARCHAR(max)
    Numeric: DataType.NUMERIC,  # rendered NUMERIC(p,s); CORE's DECIMAL does not apply
    mssql.DECIMAL: DataType.DECIMAL,  # an explicit DECIMAL(p,s) column keeps DECIMAL
    mssql.TINYINT: DataType.TINYINT,
    mssql.BIT: DataType.BIT,
    mssql.MONEY: DataType.MONEY,
    # OM's enum has no fixed-point money member below MONEY, so SMALLMONEY collapses onto NUMBER.
    mssql.SMALLMONEY: DataType.NUMBER,
    mssql.REAL: DataType.FLOAT,
    mssql.NCHAR: DataType.CHAR,
    mssql.NVARCHAR: DataType.VARCHAR,
    # Ingestion keeps neither the fractional-second precision nor the zone in the data type.
    mssql.DATETIME2: DataType.DATETIME,
    mssql.SMALLDATETIME: DataType.DATETIME,
    mssql.DATETIMEOFFSET: DataType.DATETIME,
    BINARY: DataType.BINARY,
    mssql.VARBINARY: DataType.VARBINARY,
    mssql.UNIQUEIDENTIFIER: DataType.UUID,
    mssql.XML: DataType.XML,
    # rowversion is an 8-byte row counter that SQL Server reflects through its ANSI
    # synonym `timestamp`, and ingestion has always stored it as TIMESTAMP. Renaming
    # the type is a product decision beyond this migration; the value it samples is
    # asserted in test_samples.py instead.
    mssql.ROWVERSION: DataType.TIMESTAMP,
}

_DESCRIBED_COLUMNS = {NATIVE_INTEGER_COLUMN: NATIVE_INTEGER_DESCRIPTION}


def mssql_expected(
    service_name: str,
    *,
    database: str,
    schema: str,
    reference_date: date,
    tables: Collection[str] | None = None,
    native_table_description: str = NATIVE_TABLE_DESCRIPTION,
) -> ExpectedService:
    """Return the expected MSSQL catalog for `service_name`.

    `tables=None` returns the full catalog; `tables=[...]` keeps only the named
    entities, for the complete-inventory filter checks. Only the objects carrying
    an extended property declare a description: the MSSQL dialect emits no comments.
    """
    metadata = build_mssql_baseline(schema, reference_date=reference_date).metadata
    expected = derive_expected_service(
        service_name=service_name,
        service_type=DatabaseServiceType.Mssql,
        metadata=metadata,
        type_map=MSSQL_TYPE_MAP,
        database=database,
        views=[_expected_native_view(metadata)],
        stored_procedures=[
            ExpectedStoredProcedure(
                name=ACTIVE_CUSTOMER_PROCEDURE,
                description=ACTIVE_CUSTOMER_PROCEDURE_DESCRIPTION,
            )
        ],
    )
    declared = expected.databases[0].schemas[0]
    declared.tables[:] = [_describe(table, native_table_description) for table in declared.tables]
    if tables is not None:
        kept = set(tables)
        declared.tables[:] = [table for table in declared.tables if table.name in kept]
    return expected


def _describe(table: ExpectedTable, native_table_description: str) -> ExpectedTable:
    """Apply the extended properties the baseline declares for the native table."""
    if table.name != NATIVE_TABLE:
        return table
    columns = [
        replace(column, description=_DESCRIBED_COLUMNS[column.name]) if column.name in _DESCRIBED_COLUMNS else column
        for column in table.columns
    ]
    return replace(table, description=native_table_description, columns=columns)


def _expected_native_view(metadata) -> ExpectedTable:
    """The view projects the native table's columns by name, so it carries the same types.

    SQL Server keeps no nullability constraint on a view column, so only names and
    types are declared here.
    """
    native = next(table for table in derive_expected_tables(metadata, MSSQL_TYPE_MAP) if table.name == NATIVE_TABLE)
    return ExpectedTable(
        name=NATIVE_VIEW,
        table_type=TableType.View,
        columns=[replace(column, constraint=None, description=None) for column in native.columns],
    )
