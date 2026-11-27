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
"""MSSQL source declarations: native types, the v1 persons table, a view and a procedure."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, Column, Date, Integer, MetaData, String, Table
from sqlalchemy.dialects import mssql

from ..features.database.common_baseline import (
    COMMON_CUSTOMER_ROWS,
    COMMON_TRANSACTION_ROWS,
    build_common_metadata,
)
from ..features.database.source import SqlSourceBaseline, TableSeed

NATIVE_TABLE = "all_datatypes"
NATIVE_VIEW = "view_all_datatypes"
PARTITIONED_TABLE = "persons"
ACTIVE_CUSTOMER_PROCEDURE = "usp_active_customer_count"

# The 30-YEAR TIME-UNIT window v1 configured, kept so the seeds, the profiler
# configuration and the expected metrics all read the same numbers.
PARTITION_COLUMN = "birthdate"
PARTITION_INTERVAL_YEARS = 30
# Offsets from the run date. v1 hard-coded birthdates, which silently leave the
# window as the years pass; these are resolved against today on every run.
PARTITION_YEARS_INSIDE = (1, 10, 29)
PARTITION_YEARS_OUTSIDE = (31, 40, 60)
PERSONS_ROW_COUNT = len(PARTITION_YEARS_INSIDE) + len(PARTITION_YEARS_OUTSIDE)

NATIVE_INTEGER_COLUMN = "int_col"
NATIVE_INTEGER_VALUE = 1234567890
NATIVE_UPDATED_INTEGER_VALUE = 987654321
NATIVE_UUID_VALUE = UUID("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")
NATIVE_XML_VALUE = "<root><item>1</item></root>"
# SQL Server maintains rowversion itself and rejects an INSERT that supplies one,
# so the column is declared but never seeded.
ROWVERSION_COLUMN = "rowversion_col"

# SQL Server keeps object descriptions in extended properties, which no SQLAlchemy
# DDL emits, so table/column comments are declared here and added by the statements
# below rather than through MetaData comments.
NATIVE_TABLE_DESCRIPTION = "Native MSSQL datatype fixture owned by CLI E2E v2."
NATIVE_TABLE_UPDATED_DESCRIPTION = "Updated native MSSQL datatype fixture."
NATIVE_INTEGER_DESCRIPTION = "Integer column the sample scenarios replace."
ACTIVE_CUSTOMER_PROCEDURE_DESCRIPTION = "Count the customers whose status is active."


def _years_before(reference: date, years: int) -> date:
    """The same calendar day `years` earlier, stepping off 29 February."""
    day = 28 if (reference.month, reference.day) == (2, 29) else reference.day
    return date(reference.year - years, reference.month, day)


def person_birthdates(reference: date) -> tuple[list[date], list[date]]:
    """Birthdates inside and outside the 30-YEAR partition window, relative to `reference`."""
    return (
        [_years_before(reference, years) for years in PARTITION_YEARS_INSIDE],
        [_years_before(reference, years) for years in PARTITION_YEARS_OUTSIDE],
    )


def _declare_all_datatypes(metadata: MetaData) -> None:
    Table(
        NATIVE_TABLE,
        metadata,
        Column("id", Integer, primary_key=True, nullable=False),
        Column(NATIVE_INTEGER_COLUMN, Integer),
        Column("bigint_col", mssql.BIGINT),
        Column("smallint_col", mssql.SMALLINT),
        Column("tinyint_col", mssql.TINYINT),
        Column("bit_col", mssql.BIT),
        Column("decimal_col", mssql.DECIMAL(10, 2)),
        Column("numeric_col", mssql.NUMERIC(10, 2)),
        Column("money_col", mssql.MONEY),
        Column("smallmoney_col", mssql.SMALLMONEY),
        Column("float_col", mssql.FLOAT),
        Column("real_col", mssql.REAL),
        Column("char_col", mssql.CHAR(10)),
        Column("varchar_col", mssql.VARCHAR(50)),
        Column("nchar_col", mssql.NCHAR(10)),
        Column("nvarchar_col", mssql.NVARCHAR(50)),
        Column("date_col", mssql.DATE),
        Column("time_col", mssql.TIME),
        Column("datetime_col", mssql.DATETIME),
        Column("datetime2_col", mssql.DATETIME2),
        Column("smalldatetime_col", mssql.SMALLDATETIME),
        Column("datetimeoffset_col", mssql.DATETIMEOFFSET),
        Column("binary_col", mssql.BINARY(4)),
        Column("varbinary_col", mssql.VARBINARY(10)),
        Column("uniqueidentifier_col", mssql.UNIQUEIDENTIFIER),
        Column("xml_col", mssql.XML),
        # #34360 patched how a rowversion value reaches a persisted sample; the
        # sample assertions here are the reason this column exists.
        Column(ROWVERSION_COLUMN, mssql.ROWVERSION),
    )


def _declare_persons(metadata: MetaData) -> None:
    """v1's MSSQL fixture table, kept so the TIME-UNIT partition scenario matches v1's shape."""
    Table(
        PARTITIONED_TABLE,
        metadata,
        Column("person_id", Integer, primary_key=True, nullable=False),
        Column("full_name", String(255), nullable=False),
        Column(PARTITION_COLUMN, Date, nullable=False),
        Column("is_meeting_scheduled", Boolean, nullable=False),
    )


_NATIVE_VALUES: dict[str, Any] = {
    NATIVE_INTEGER_COLUMN: NATIVE_INTEGER_VALUE,
    "bigint_col": 9000000000,
    "smallint_col": 32767,
    "tinyint_col": 255,
    "bit_col": True,
    "decimal_col": Decimal("1234.56"),
    "numeric_col": Decimal("1234.56"),
    "money_col": Decimal("1234.5600"),
    "smallmoney_col": Decimal("12.3400"),
    "float_col": 1234.5678,
    "real_col": 1.5,
    "char_col": "abcdefghij",
    "varchar_col": "abcdefghij",
    "nchar_col": "abcdefghij",
    "nvarchar_col": "abcdefghij",
    "date_col": date(2022, 8, 8),
    "time_col": datetime(2022, 8, 8, 12, 34, 56).time(),
    "datetime_col": datetime(2022, 8, 8, 12, 34, 56),
    "datetime2_col": datetime(2022, 8, 8, 12, 34, 56),
    "smalldatetime_col": datetime(2022, 8, 8, 12, 34, 0),
    "datetimeoffset_col": datetime(2022, 8, 8, 12, 34, 56),
    "binary_col": b"\x01\x02\x03\x04",
    "varbinary_col": b"\x01\x02",
    "uniqueidentifier_col": str(NATIVE_UUID_VALUE),
    "xml_col": NATIVE_XML_VALUE,
}

NATIVE_COLUMN_NAMES: tuple[str, ...] = ("id", *_NATIVE_VALUES, ROWVERSION_COLUMN)
PERSON_NAMES = (
    "Peter Parker",
    "Bruce Banner",
    "Steve Rogers",
    "Natasha Romanoff",
    "Wanda Maximoff",
    "Diana Prince",
)


def _persons_rows(reference: date) -> list[dict[str, Any]]:
    inside, outside = person_birthdates(reference)
    return [
        {
            "person_id": index,
            "full_name": name,
            PARTITION_COLUMN: birthdate,
            "is_meeting_scheduled": index % 2 == 1,
        }
        for index, (name, birthdate) in enumerate(zip(PERSON_NAMES, [*inside, *outside], strict=True), start=1)
    ]


def _strip_comments(metadata: MetaData) -> None:
    """Drop the shared declarations' comments: the MSSQL dialect emits none of them.

    Descriptions this suite asserts are added below as extended properties, so a
    retained comment would be an expectation nothing in the source can satisfy.
    """
    for table in metadata.tables.values():
        table.comment = None
        for column in table.columns:
            column.comment = None


def _extended_property(schema: str, description: str, **levels: str) -> str:
    arguments = "".join(
        f", @level{index}type=N'{level_type}', @level{index}name=N'{name}'"
        for index, (level_type, name) in enumerate(levels.items(), start=1)
    )
    return (
        f"EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'{description}'"
        f", @level0type=N'SCHEMA', @level0name=N'{schema}'{arguments}"
    )


def build_mssql_baseline(schema: str, *, reference_date: date) -> SqlSourceBaseline:
    """Declare one owned MSSQL schema; `reference_date` anchors the partition seeds."""
    metadata = build_common_metadata(schema)
    _declare_all_datatypes(metadata)
    _declare_persons(metadata)
    _strip_comments(metadata)
    quote = mssql.dialect().identifier_preparer.quote_identifier
    owned = quote(schema)
    native_columns = ", ".join(NATIVE_COLUMN_NAMES)
    return SqlSourceBaseline(
        metadata=metadata,
        seeds=[
            TableSeed("customers", COMMON_CUSTOMER_ROWS),
            TableSeed("transactions", COMMON_TRANSACTION_ROWS),
            TableSeed(NATIVE_TABLE, [{"id": 1, **_NATIVE_VALUES}]),
            TableSeed(PARTITIONED_TABLE, _persons_rows(reference_date)),
        ],
        ddl=[
            # Columns are projected by name rather than with SELECT *, so the stored
            # view definition carries every column edge on its own.
            f"CREATE VIEW {owned}.{NATIVE_VIEW} AS SELECT {native_columns} FROM {owned}.{NATIVE_TABLE}",
            # Named usp_ rather than sp_: the connector's default stored-procedure
            # filter excludes ^sp_, ^xp_ and ^ms_.
            f"""
            CREATE PROCEDURE {owned}.{ACTIVE_CUSTOMER_PROCEDURE} AS
            BEGIN
                SELECT COUNT(*) AS active_customers FROM {owned}.customers WHERE status = 'active';
            END
            """,
            _extended_property(schema, NATIVE_TABLE_DESCRIPTION, TABLE=NATIVE_TABLE),
            _extended_property(schema, NATIVE_INTEGER_DESCRIPTION, TABLE=NATIVE_TABLE, COLUMN=NATIVE_INTEGER_COLUMN),
            _extended_property(schema, ACTIVE_CUSTOMER_PROCEDURE_DESCRIPTION, PROCEDURE=ACTIVE_CUSTOMER_PROCEDURE),
        ],
    )
