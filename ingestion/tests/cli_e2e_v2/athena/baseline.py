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
"""Athena source declarations: Glue tables over owned S3 prefixes, their seeds and a view.

Athena cannot run `CREATE TABLE` from SQLAlchemy MetaData: every table is a Glue entry over S3,
written as Hive (`CREATE EXTERNAL TABLE ... STORED AS PARQUET`) or Iceberg DDL. The declarations
here render that DDL and the seed `INSERT`s; the persisted expectations live in `expected.py`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from ..features.database.common_baseline import COMMON_CUSTOMER_ROWS

DATABASE_DESCRIPTION = "Owned Glue database for the Athena CLI E2E v2 suite."
CUSTOMERS_DESCRIPTION = "Customer master table used by Athena CLI E2E."


class TableFormat(Enum):
    HIVE = "hive"
    ICEBERG = "iceberg"


@dataclass(frozen=True)
class Raw:
    """A literal SQL expression for values no Python literal can express, such as ARRAY or ROW."""

    sql: str


@dataclass(frozen=True)
class AthenaColumn:
    name: str
    hive_type: str
    comment: str | None = None


@dataclass(frozen=True)
class AthenaTable:
    name: str
    table_format: TableFormat
    columns: tuple[AthenaColumn, ...]
    rows: tuple[dict[str, Any], ...]
    partition_columns: tuple[AthenaColumn, ...] = ()
    comment: str | None = None

    @property
    def insert_columns(self) -> tuple[AthenaColumn, ...]:
        # Athena writes Hive partitions from the trailing columns of an INSERT.
        return self.columns + self.partition_columns


@dataclass(frozen=True)
class AthenaView:
    name: str
    select: str  # formatted with {database}


@dataclass(frozen=True)
class AthenaBaseline:
    tables: tuple[AthenaTable, ...]
    views: tuple[AthenaView, ...] = field(default_factory=tuple)

    def table(self, name: str) -> AthenaTable:
        for table in self.tables:
            if table.name == name:
                return table
        raise KeyError(name)


def _string_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _cast_type(hive_type: str) -> str:
    """Hive DDL types to the Trino types Athena DML casts to."""
    simple = {"string": "varchar", "int": "integer", "float": "real", "binary": "varbinary"}
    return simple.get(hive_type, hive_type)


def render_value(value: Any, hive_type: str) -> str:
    """One INSERT value cast to its column's type, so narrow Hive columns accept it."""
    if isinstance(value, Raw):
        return value.sql
    if value is None:
        literal = "NULL"
    elif isinstance(value, bool):
        literal = "TRUE" if value else "FALSE"
    elif isinstance(value, (int, Decimal)):
        literal = str(value)
    elif isinstance(value, datetime):
        literal = f"TIMESTAMP '{value:%Y-%m-%d %H:%M:%S}'"
    elif isinstance(value, date):
        literal = f"DATE '{value:%Y-%m-%d}'"
    elif isinstance(value, bytes):
        literal = f"X'{value.hex()}'"
    elif isinstance(value, str):
        literal = _string_literal(value)
    else:
        raise TypeError(f"Unsupported Athena seed value {type(value).__name__}")
    return f"CAST({literal} AS {_cast_type(hive_type)})"


def _column_ddl(column: AthenaColumn) -> str:
    comment = f" COMMENT {_string_literal(column.comment)}" if column.comment else ""
    return f"`{column.name}` {column.hive_type}{comment}"


def create_table_ddl(table: AthenaTable, *, database: str, location: str) -> str:
    columns = ", ".join(_column_ddl(column) for column in table.columns)
    if table.table_format is TableFormat.ICEBERG:
        if table.comment or table.partition_columns:
            raise ValueError("Iceberg fixture tables declare neither a comment nor partitions")
        return (
            f"CREATE TABLE `{database}`.`{table.name}` ({columns}) "
            f"LOCATION '{location}' TBLPROPERTIES ('table_type'='ICEBERG')"
        )
    comment = f" COMMENT {_string_literal(table.comment)}" if table.comment else ""
    partitions = ""
    if table.partition_columns:
        partitions = " PARTITIONED BY (" + ", ".join(_column_ddl(c) for c in table.partition_columns) + ")"
    return (
        f"CREATE EXTERNAL TABLE `{database}`.`{table.name}` ({columns}){comment}{partitions} "
        f"STORED AS PARQUET LOCATION '{location}'"
    )


def insert_sql(table: AthenaTable, *, database: str) -> str:
    columns = table.insert_columns
    names = ", ".join(f'"{column.name}"' for column in columns)
    values = ", ".join(
        "(" + ", ".join(render_value(row[column.name], column.hive_type) for column in columns) + ")"
        for row in table.rows
    )
    return f'INSERT INTO "{database}"."{table.name}" ({names}) VALUES {values}'


def create_view_sql(view: AthenaView, *, database: str) -> str:
    return f'CREATE VIEW "{database}"."{view.name}" AS {view.select.format(database=database)}'


_CUSTOMERS = AthenaTable(
    name="customers",
    table_format=TableFormat.HIVE,
    comment=CUSTOMERS_DESCRIPTION,
    columns=(
        AthenaColumn("id", "int", "Primary key identifying the customer."),
        AthenaColumn("first_name", "varchar(50)", "Customer first name."),
        AthenaColumn("last_name", "varchar(50)"),
        AthenaColumn("full_name", "varchar(100)"),
        AthenaColumn("email", "varchar(255)", "Customer email address."),
        AthenaColumn("address", "varchar(255)"),
        AthenaColumn("city", "varchar(100)"),
        AthenaColumn("country", "varchar(100)"),
        AthenaColumn("zipcode", "varchar(20)"),
        AthenaColumn("date_of_birth", "date"),
        AthenaColumn("age", "int"),
        AthenaColumn("credit_score", "int"),
        AthenaColumn("status", "varchar(20)"),
        AthenaColumn("is_active", "boolean"),
        AthenaColumn("bio", "string"),
        AthenaColumn("joined_date", "date"),
    ),
    rows=tuple(COMMON_CUSTOMER_ROWS),
)

ORDER_STATUSES = ("placed", "shipped", "delivered", "placed", "cancelled")

_ORDERS = AthenaTable(
    name="orders",
    table_format=TableFormat.ICEBERG,
    columns=(
        AthenaColumn("id", "int", "Order identifier."),
        AthenaColumn("customer_id", "int"),
        AthenaColumn("amount", "decimal(10,2)"),
        AthenaColumn("status", "string"),
        AthenaColumn("ordered_at", "timestamp"),
    ),
    rows=tuple(
        {
            "id": index,
            "customer_id": index,
            "amount": Decimal(f"{index * 10}.50"),
            "status": status,
            "ordered_at": datetime(2026, 1, index, 9, 30, 0),
        }
        for index, status in enumerate(ORDER_STATUSES, start=1)
    ),
)

_SALES = AthenaTable(
    name="sales",
    table_format=TableFormat.HIVE,
    columns=(
        AthenaColumn("id", "int"),
        AthenaColumn("amount", "decimal(10,2)"),
        AthenaColumn("region", "string"),
    ),
    partition_columns=(AthenaColumn("sale_date", "string"),),
    rows=(
        {"id": 1, "amount": Decimal("10.50"), "region": "east", "sale_date": "2026-01-01"},
        {"id": 2, "amount": Decimal("20.00"), "region": "west", "sale_date": "2026-01-01"},
        {"id": 3, "amount": Decimal("30.25"), "region": "east", "sale_date": "2026-01-02"},
    ),
)

NATIVE_ROW: dict[str, Any] = {
    "c_boolean": True,
    "c_tinyint": 127,
    "c_smallint": 32767,
    "c_int": 1234567890,
    "c_bigint": 9223372036854775807,
    "c_float": Decimal("1.5"),
    "c_double": Decimal("1234.5678"),
    "c_decimal": Decimal("1234.56"),
    "c_char": "abcdefghij",
    "c_varchar": "abcdefghij",
    "c_string": "native athena string",
    "c_date": date(2022, 8, 8),
    "c_timestamp": datetime(2022, 8, 8, 12, 34, 56),
    "c_binary": b"athena",
    "c_array": Raw("ARRAY['a', 'b']"),
    "c_map": Raw("MAP(ARRAY['k'], ARRAY[1])"),
    "c_struct": Raw("CAST(ROW(1, 'x') AS ROW(a INTEGER, b VARCHAR))"),
}

_ALL_DATATYPES = AthenaTable(
    name="all_datatypes",
    table_format=TableFormat.HIVE,
    columns=(
        AthenaColumn("c_boolean", "boolean"),
        AthenaColumn("c_tinyint", "tinyint"),
        AthenaColumn("c_smallint", "smallint"),
        AthenaColumn("c_int", "int"),
        AthenaColumn("c_bigint", "bigint"),
        AthenaColumn("c_float", "float"),
        AthenaColumn("c_double", "double"),
        AthenaColumn("c_decimal", "decimal(10,2)"),
        AthenaColumn("c_char", "char(10)"),
        AthenaColumn("c_varchar", "varchar(10)"),
        AthenaColumn("c_string", "string"),
        AthenaColumn("c_date", "date"),
        AthenaColumn("c_timestamp", "timestamp"),
        AthenaColumn("c_binary", "binary"),
        AthenaColumn("c_array", "array<string>"),
        AthenaColumn("c_map", "map<string,int>"),
        AthenaColumn("c_struct", "struct<a:int,b:string>"),
    ),
    rows=(NATIVE_ROW,),
)

_VIEW_CUSTOMERS = AthenaView(
    name="view_customers",
    select='SELECT "id", "credit_score", "date_of_birth" FROM "{database}"."customers"',
)

VIEW_COLUMNS = ("id", "credit_score", "date_of_birth")


def build_athena_baseline() -> AthenaBaseline:
    return AthenaBaseline(tables=(_CUSTOMERS, _ORDERS, _SALES, _ALL_DATATYPES), views=(_VIEW_CUSTOMERS,))
