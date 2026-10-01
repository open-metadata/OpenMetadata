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
"""Authored Postgres catalog expectations, independent of connector parsers."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Numeric
from sqlalchemy.dialects import postgresql

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType

from ..features.database.catalog.derive import derive_expected_service
from ..features.database.catalog.type_map import CORE_TYPE_MAP, TypeMap
from ..features.database.catalog.types import ExpectedColumn, ExpectedService, ExpectedTable
from .baseline import build_postgres_baseline

if TYPE_CHECKING:
    from collections.abc import Collection


POSTGRES_TYPE_MAP: TypeMap = {
    **CORE_TYPE_MAP,
    DateTime: DataType.TIMESTAMP,
    Numeric: DataType.NUMERIC,
    postgresql.DOUBLE_PRECISION: DataType.DOUBLE,
    postgresql.REAL: DataType.FLOAT,
    postgresql.INTERVAL: DataType.INTERVAL,
    postgresql.JSONB: DataType.JSON,
    postgresql.UUID: DataType.UUID,
    postgresql.TIMESTAMP: DataType.TIMESTAMP,
}

_NATIVE_COLUMNS = (
    ("column1", DataType.BIGINT),
    ("column2", DataType.BIGINT),
    ("column5", DataType.BOOLEAN),
    ("column6", DataType.CHAR),
    ("column7", DataType.VARCHAR),
    ("column8", DataType.DATE),
    ("column9", DataType.DOUBLE),
    ("column10", DataType.INT),
    ("column11", DataType.INTERVAL),
    ("column12", DataType.JSON),
    ("column13", DataType.JSON),
    ("column14", DataType.NUMERIC),
    ("column15", DataType.FLOAT),
    ("column16", DataType.SMALLINT),
    ("column17", DataType.SMALLINT),
    ("column28", DataType.INT),
    ("column29", DataType.TEXT),
    ("column20", DataType.TIME),
    ("column21", DataType.TIME),
    ("column22", DataType.TIMESTAMP),
    ("column23", DataType.TIMESTAMP),
    ("column24", DataType.UUID),
)


def postgres_expected(
    service_name: str,
    *,
    database: str,
    schema: str,
    tables: Collection[str] | None = None,
) -> ExpectedService:
    expected = derive_expected_service(
        service_name=service_name,
        service_type=DatabaseServiceType.Postgres,
        metadata=build_postgres_baseline(schema).metadata,
        type_map=POSTGRES_TYPE_MAP,
        database=database,
        views=[
            ExpectedTable(
                name="view_all_datatypes",
                table_type=TableType.View,
                columns=[ExpectedColumn(name, data_type) for name, data_type in _NATIVE_COLUMNS],
            )
        ],
    )
    if tables is not None:
        kept = set(tables)
        declared = expected.databases[0].schemas[0]
        declared.tables[:] = [table for table in declared.tables if table.name in kept]
    return expected
