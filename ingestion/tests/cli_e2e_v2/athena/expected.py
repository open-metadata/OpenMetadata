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
"""Authored Athena catalog expectations, independent of connector parsers.

Athena declares no keys and Hive/Iceberg columns are always nullable, so every column is `NULL`.
Ingestion maps `tinyint`/`smallint` to `INT` and `double` to `FLOAT`; this encodes what OM stores.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from metadata.generated.schema.entity.data.table import Constraint, DataType, TableType
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType

from ..features.database.catalog.types import (
    ExpectedColumn,
    ExpectedDatabase,
    ExpectedSchema,
    ExpectedService,
    ExpectedTable,
)
from .baseline import CUSTOMERS_DESCRIPTION

if TYPE_CHECKING:
    from collections.abc import Collection

ALL_TABLES = frozenset({"customers", "orders", "sales", "all_datatypes", "view_customers"})


def _columns(*specs: tuple[str, DataType] | tuple[str, DataType, str]) -> list[ExpectedColumn]:
    return [
        ExpectedColumn(spec[0], spec[1], constraint=Constraint.NULL, description=spec[2] if len(spec) > 2 else None)
        for spec in specs
    ]


_TABLES = (
    ExpectedTable(
        name="customers",
        table_type=TableType.External,
        description=CUSTOMERS_DESCRIPTION,
        columns=_columns(
            ("id", DataType.INT, "Primary key identifying the customer."),
            ("first_name", DataType.VARCHAR, "Customer first name."),
            ("last_name", DataType.VARCHAR),
            ("full_name", DataType.VARCHAR),
            ("email", DataType.VARCHAR, "Customer email address."),
            ("address", DataType.VARCHAR),
            ("city", DataType.VARCHAR),
            ("country", DataType.VARCHAR),
            ("zipcode", DataType.VARCHAR),
            ("date_of_birth", DataType.DATE),
            ("age", DataType.INT),
            ("credit_score", DataType.INT),
            ("status", DataType.VARCHAR),
            ("is_active", DataType.BOOLEAN),
            ("bio", DataType.STRING),
            ("joined_date", DataType.DATE),
        ),
    ),
    ExpectedTable(
        name="orders",
        table_type=TableType.Iceberg,
        columns=_columns(
            ("id", DataType.INT, "Order identifier."),
            ("customer_id", DataType.INT),
            ("amount", DataType.DECIMAL),
            ("status", DataType.STRING),
            ("ordered_at", DataType.TIMESTAMP),
        ),
    ),
    ExpectedTable(
        name="sales",
        table_type=TableType.Partitioned,
        columns=_columns(
            ("id", DataType.INT),
            ("amount", DataType.DECIMAL),
            ("region", DataType.STRING),
            ("sale_date", DataType.STRING),
        ),
    ),
    ExpectedTable(
        name="all_datatypes",
        table_type=TableType.External,
        columns=_columns(
            ("c_boolean", DataType.BOOLEAN),
            ("c_tinyint", DataType.INT),
            ("c_smallint", DataType.INT),
            ("c_int", DataType.INT),
            ("c_bigint", DataType.BIGINT),
            ("c_float", DataType.FLOAT),
            ("c_double", DataType.FLOAT),
            ("c_decimal", DataType.DECIMAL),
            ("c_char", DataType.CHAR),
            ("c_varchar", DataType.VARCHAR),
            ("c_string", DataType.STRING),
            ("c_date", DataType.DATE),
            ("c_timestamp", DataType.TIMESTAMP),
            ("c_binary", DataType.BINARY),
            ("c_array", DataType.ARRAY),
            ("c_map", DataType.MAP),
            ("c_struct", DataType.STRUCT),
        ),
    ),
    ExpectedTable(
        name="view_customers",
        table_type=TableType.View,
        columns=_columns(("id", DataType.INT), ("credit_score", DataType.INT), ("date_of_birth", DataType.DATE)),
    ),
)


def athena_schema(database: str, *, tables: Collection[str] | None = None) -> ExpectedSchema:
    kept = ALL_TABLES if tables is None else frozenset(tables)
    if kept - ALL_TABLES:
        raise ValueError(f"Unknown Athena fixture tables: {sorted(kept - ALL_TABLES)}")
    return ExpectedSchema(name=database, tables=[table for table in _TABLES if table.name in kept])


def athena_expected(service_name: str, om_database: str, *schemas: ExpectedSchema) -> ExpectedService:
    return ExpectedService(
        name=service_name,
        service_type=DatabaseServiceType.Athena,
        databases=[ExpectedDatabase(name=om_database, schemas=list(schemas))],
    )
