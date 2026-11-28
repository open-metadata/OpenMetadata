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
"""Redshift source declarations: the portable tables plus Redshift-native objects.

`metadata` declares every table the suite asserts, so expectations derive from it.
Objects SQLAlchemy cannot emit (DISTKEY/SORTKEY, SUPER/VARBYTE/GEOMETRY values,
views, the materialized view and the procedure) are created by the ordered `ddl`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import (
    VARBINARY,
    BigInteger,
    Boolean,
    Column,
    Date,
    Integer,
    MetaData,
    Numeric,
    SmallInteger,
    String,
    Table,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy_redshift import dialect as redshift

from ..features.database.common_baseline import (
    COMMON_CUSTOMER_ROWS,
    COMMON_TRANSACTION_ROWS,
    build_common_metadata,
)
from ..features.database.source import SqlSourceBaseline, TableSeed

if TYPE_CHECKING:
    from datetime import date

CUSTOMERS_DESCRIPTION = "Customer master table used by Redshift CLI E2E."

NATIVE_TABLE = "all_datatypes"
NATIVE_VIEW = "view_all_datatypes"
LATE_BINDING_VIEW = "late_binding_customers"
MATERIALIZED_VIEW = "mv_active_customers"
ACTIVE_CUSTOMER_PROCEDURE = "active_customer_count"
PARTITIONED_TABLE = "persons"
PROFILE_TABLE = "profile_values"

NATIVE_TABLE_DESCRIPTION = "Redshift native types fixture."
NATIVE_TABLE_UPDATED_DESCRIPTION = "Updated Redshift native types fixture."
NATIVE_INTEGER_COLUMN = "int_col"
NATIVE_INTEGER_VALUE = 1234567890
NATIVE_UPDATED_INTEGER_VALUE = 987654321
DIST_KEY_COLUMN = NATIVE_INTEGER_COLUMN
SORT_KEY_COLUMN = "date_col"

# A TIME-UNIT window over `birthdate`. The seeds are offsets from the run date, so
# the same rows stay inside and outside the window however long the suite lives.
PARTITION_COLUMN = "birthdate"
PARTITION_INTERVAL_YEARS = 30
PARTITION_YEARS_INSIDE = (1, 10, 29)
PARTITION_YEARS_OUTSIDE = (31, 40, 60)
PERSONS_ROW_COUNT = len(PARTITION_YEARS_INSIDE) + len(PARTITION_YEARS_OUTSIDE)

NATIVE_COLUMN_NAMES = (
    "id",
    NATIVE_INTEGER_COLUMN,
    "smallint_col",
    "bigint_col",
    "decimal_col",
    "real_col",
    "double_col",
    "bool_col",
    "char_col",
    "varchar_col",
    SORT_KEY_COLUMN,
    "timestamp_col",
    "timestamptz_col",
    "time_col",
    "timetz_col",
    "super_col",
    "varbyte_col",
    "geometry_col",
)
LATE_BINDING_COLUMNS = ("id", "full_name", "status")
MATERIALIZED_VIEW_COLUMNS = ("id", "full_name")

_NATIVE_DDL_COLUMNS = (
    "id INTEGER NOT NULL PRIMARY KEY, int_col INTEGER NOT NULL, smallint_col SMALLINT, bigint_col BIGINT, "
    "decimal_col DECIMAL(18,4), real_col REAL, double_col DOUBLE PRECISION, bool_col BOOLEAN, "
    "char_col CHAR(10), varchar_col VARCHAR(64), date_col DATE, timestamp_col TIMESTAMP, "
    "timestamptz_col TIMESTAMPTZ, time_col TIME, timetz_col TIMETZ, super_col SUPER, "
    "varbyte_col VARBYTE(16), geometry_col GEOMETRY"
)
_NATIVE_DDL_VALUES = (
    f"1, {NATIVE_INTEGER_VALUE}, 32767, 9000000000, 1234.5600, 1.5, 1234.5678, TRUE, 'abcdefghij', "
    "'text value', '2026-01-02', '2026-01-02 12:34:56', '2026-01-02 12:34:56+00', '12:34:56', "
    "'12:34:56+00', JSON_PARSE('{\"kind\": \"fixture\", \"count\": 2}'), FROM_HEX('616263'), "
    "ST_GeomFromText('POINT(1 2)')"
)


def _years_before(reference: date, years: int) -> date:
    # 29 February has no counterpart in most years; the 28th keeps the offset.
    try:
        return reference.replace(year=reference.year - years)
    except ValueError:
        return reference.replace(year=reference.year - years, day=28)


def person_birthdates(reference: date) -> tuple[list[date], list[date]]:
    """Birthdates inside and outside the TIME-UNIT window, relative to `reference`."""
    return (
        [_years_before(reference, years) for years in PARTITION_YEARS_INSIDE],
        [_years_before(reference, years) for years in PARTITION_YEARS_OUTSIDE],
    )


def _declare_native_tables(metadata: MetaData) -> None:
    Table(
        NATIVE_TABLE,
        metadata,
        Column("id", Integer, primary_key=True, nullable=False),
        Column(NATIVE_INTEGER_COLUMN, Integer, nullable=False),
        Column("smallint_col", SmallInteger),
        Column("bigint_col", BigInteger),
        Column("decimal_col", Numeric(18, 4)),
        Column("real_col", redshift.REAL),
        Column("double_col", redshift.DOUBLE_PRECISION),
        Column("bool_col", Boolean),
        Column("char_col", redshift.CHAR(10)),
        Column("varchar_col", String(64)),
        Column(SORT_KEY_COLUMN, Date),
        Column("timestamp_col", postgresql.TIMESTAMP),
        Column("timestamptz_col", redshift.TIMESTAMPTZ),
        Column("time_col", postgresql.TIME),
        Column("timetz_col", redshift.TIMETZ),
        Column("super_col", redshift.SUPER),
        Column("varbyte_col", VARBINARY(16)),
        Column("geometry_col", redshift.GEOMETRY),
        comment=NATIVE_TABLE_DESCRIPTION,
    )
    Table(
        PARTITIONED_TABLE,
        metadata,
        Column("person_id", Integer, primary_key=True, nullable=False),
        Column("full_name", String(255), nullable=False),
        Column(PARTITION_COLUMN, Date, nullable=False),
    )
    Table(
        PROFILE_TABLE,
        metadata,
        Column("id", Integer, nullable=False),
        Column("score", Integer),
    )


# Tables `create_all` emits; the native table needs DISTKEY/SORTKEY, so its DDL is hand-written.
CREATED_TABLES = ("customers", "transactions", PARTITIONED_TABLE, PROFILE_TABLE)


def build_redshift_baseline(schema: str, *, reference_date: date) -> SqlSourceBaseline:
    metadata = build_common_metadata(schema)
    metadata.tables[f"{schema}.customers"].comment = CUSTOMERS_DESCRIPTION
    _declare_native_tables(metadata)
    owned = f'"{schema}"'
    inside, outside = person_birthdates(reference_date)
    persons = [
        {"person_id": index, "full_name": f"Person {index}", PARTITION_COLUMN: birthdate}
        for index, birthdate in enumerate(inside + outside, start=1)
    ]
    return SqlSourceBaseline(
        metadata=metadata,
        seeds=[
            TableSeed("customers", COMMON_CUSTOMER_ROWS),
            TableSeed("transactions", COMMON_TRANSACTION_ROWS),
            TableSeed(PARTITIONED_TABLE, persons),
        ],
        ddl=[
            f"CREATE TABLE {owned}.{NATIVE_TABLE} ({_NATIVE_DDL_COLUMNS}) "
            f"DISTSTYLE KEY DISTKEY ({DIST_KEY_COLUMN}) SORTKEY ({SORT_KEY_COLUMN})",
            f"COMMENT ON TABLE {owned}.{NATIVE_TABLE} IS '{NATIVE_TABLE_DESCRIPTION}'",
            f"INSERT INTO {owned}.{NATIVE_TABLE} VALUES ({_NATIVE_DDL_VALUES})",
            f"CREATE VIEW {owned}.{NATIVE_VIEW} AS SELECT * FROM {owned}.{NATIVE_TABLE}",
            # Late binding: the view names no column until query time, so Redshift
            # reports its columns through pg_get_late_binding_view_cols, not pg_attribute.
            f"CREATE VIEW {owned}.{LATE_BINDING_VIEW} AS SELECT {', '.join(LATE_BINDING_COLUMNS)} "
            f"FROM {owned}.customers WITH NO SCHEMA BINDING",
            f"CREATE MATERIALIZED VIEW {owned}.{MATERIALIZED_VIEW} AS SELECT "
            f"{', '.join(MATERIALIZED_VIEW_COLUMNS)} FROM {owned}.customers WHERE status = 'active'",
            f"CREATE PROCEDURE {owned}.{ACTIVE_CUSTOMER_PROCEDURE}(INOUT total INTEGER) AS $$ "
            f"BEGIN SELECT INTO total COUNT(*) FROM {owned}.customers WHERE status = 'active'; END; "
            "$$ LANGUAGE plpgsql",
        ],
    )
