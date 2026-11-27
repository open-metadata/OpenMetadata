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
"""Authored Exasol catalog expectations, independent of connector parsers."""

from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Text

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType

from ..features.database.catalog.derive import derive_expected_service, derive_expected_tables
from ..features.database.catalog.type_map import CORE_TYPE_MAP, TypeMap
from .baseline import NATIVE_TABLE, NATIVE_TABLE_DESCRIPTION, NATIVE_VIEW, build_exasol_baseline
from .connector import EXASOL_DATABASE

if TYPE_CHECKING:
    from collections.abc import Collection

    from ..features.database.catalog.types import ExpectedService, ExpectedTable

EXASOL_TYPE_MAP: TypeMap = {
    **CORE_TYPE_MAP,
    # Exasol has one exact numeric type. INTEGER is stored as DECIMAL(18,0), which the
    # dialect reflects back as INTEGER; BIGINT is DECIMAL(36,0), past that cutoff, so
    # it stays DECIMAL.
    BigInteger: DataType.DECIMAL,
    # Exasol has no TEXT; SQLAlchemy renders it VARCHAR(2000000).
    Text: DataType.VARCHAR,
    # DATETIME renders TIMESTAMP, the only Exasol date-time type with a time part.
    DateTime: DataType.TIMESTAMP,
}


def exasol_expected(
    service_name: str,
    *,
    schema: str,
    tables: Collection[str] | None = None,
    native_table_description: str = NATIVE_TABLE_DESCRIPTION,
) -> ExpectedService:
    """Return the expected Exasol catalog for `service_name`.

    `tables=None` returns the full catalog; `tables=[...]` keeps only the named
    entities, for the complete-inventory filter checks. Exasol has no stored
    procedures the connector reads (its scripts are not procedures).
    """
    metadata = build_exasol_baseline(schema).metadata
    expected = derive_expected_service(
        service_name=service_name,
        service_type=DatabaseServiceType.Exasol,
        metadata=metadata,
        type_map=EXASOL_TYPE_MAP,
        database=EXASOL_DATABASE,
        views=[_expected_native_view(metadata)],
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


def _expected_native_view(metadata) -> ExpectedTable:
    """The view projects the native table's columns by name, so it carries the same types."""
    native = next(table for table in derive_expected_tables(metadata, EXASOL_TYPE_MAP) if table.name == NATIVE_TABLE)
    return replace(
        native,
        name=NATIVE_VIEW,
        table_type=TableType.View,
        description=None,
        columns=[replace(column, constraint=None, description=None) for column in native.columns],
    )
