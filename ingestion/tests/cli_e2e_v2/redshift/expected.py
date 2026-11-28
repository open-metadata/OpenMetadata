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
"""Authored Redshift catalog expectations, independent of connector parsers."""

from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from sqlalchemy import VARBINARY, DateTime, Numeric, Text
from sqlalchemy.dialects import postgresql
from sqlalchemy_redshift import dialect as redshift

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType

from ..features.database.catalog.derive import derive_expected_service, derive_expected_tables
from ..features.database.catalog.type_map import CORE_TYPE_MAP, TypeMap
from ..features.database.catalog.types import ExpectedColumn, ExpectedService, ExpectedStoredProcedure, ExpectedTable
from .baseline import (
    ACTIVE_CUSTOMER_PROCEDURE,
    LATE_BINDING_VIEW,
    MATERIALIZED_VIEW,
    NATIVE_TABLE,
    NATIVE_TABLE_DESCRIPTION,
    NATIVE_VIEW,
    build_redshift_baseline,
)

if TYPE_CHECKING:
    from collections.abc import Collection
    from datetime import date

REDSHIFT_TYPE_MAP: TypeMap = {
    **CORE_TYPE_MAP,
    # Redshift has no unbounded text: TEXT is stored as VARCHAR(256).
    Text: DataType.VARCHAR,
    # Redshift stores TIMESTAMP for SQLAlchemy's DateTime and reports `numeric` for DECIMAL.
    DateTime: DataType.TIMESTAMP,
    Numeric: DataType.NUMERIC,
    redshift.REAL: DataType.FLOAT,
    redshift.DOUBLE_PRECISION: DataType.DOUBLE,
    postgresql.TIMESTAMP: DataType.TIMESTAMP,
    # Ingestion keeps the zone out of the data type, as it does for every source.
    redshift.TIMESTAMPTZ: DataType.TIMESTAMP,
    postgresql.TIME: DataType.TIME,
    redshift.TIMETZ: DataType.TIME,
    redshift.SUPER: DataType.SUPER,
    VARBINARY: DataType.VARBINARY,
    redshift.GEOMETRY: DataType.GEOMETRY,
}


def redshift_expected(
    service_name: str,
    *,
    database: str,
    schema: str,
    reference_date: date,
    tables: Collection[str] | None = None,
    native_table_description: str = NATIVE_TABLE_DESCRIPTION,
) -> ExpectedService:
    """Return the expected Redshift catalog for `service_name`.

    `tables=None` returns the full catalog; `tables=[...]` keeps only the named
    entities, for the complete-inventory filter checks.
    """
    metadata = build_redshift_baseline(schema, reference_date=reference_date).metadata
    tables_by_name = {table.name: table for table in derive_expected_tables(metadata, REDSHIFT_TYPE_MAP)}
    expected = derive_expected_service(
        service_name=service_name,
        service_type=DatabaseServiceType.Redshift,
        metadata=metadata,
        type_map=REDSHIFT_TYPE_MAP,
        database=database,
        views=[
            _projection(tables_by_name[NATIVE_TABLE], NATIVE_VIEW, TableType.View),
            _projection(tables_by_name["customers"], LATE_BINDING_VIEW, TableType.View, ("id", "full_name", "status")),
            _projection(
                tables_by_name["customers"], MATERIALIZED_VIEW, TableType.MaterializedView, ("id", "full_name")
            ),
        ],
        stored_procedures=[ExpectedStoredProcedure(name=ACTIVE_CUSTOMER_PROCEDURE)],
    )
    declared = expected.databases[0].schemas[0]
    declared.tables[:] = [
        replace(table, description=native_table_description) if table.name == NATIVE_TABLE else table
        for table in declared.tables
    ]
    if tables is not None:
        kept = set(tables)
        declared.tables[:] = [table for table in declared.tables if table.name in kept]
    return expected


def _projection(
    table: ExpectedTable, name: str, table_type: TableType, columns: tuple[str, ...] | None = None
) -> ExpectedTable:
    """A view selecting `columns` of `table` by name carries their types; Redshift keeps no view constraints."""
    selected = columns or tuple(column.name for column in table.columns)
    by_name = {column.name: column for column in table.columns}
    return ExpectedTable(
        name=name,
        table_type=table_type,
        columns=[
            ExpectedColumn(name=column, data_type=by_name[column].data_type, constraint=None) for column in selected
        ],
    )
