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
"""Snowflake-native tables, seeds, keys, view, procedure and UDF in one owned schema.

Declarations use lower-case names, and Snowflake folds the unquoted identifiers to upper case.
"""

from __future__ import annotations

import snowflake.sqlalchemy as sf
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect
from sqlalchemy import Column, MetaData, Table

from ..features.database.common_baseline import (
    COMMON_CUSTOMER_ROWS,
    COMMON_TRANSACTION_ROWS,
    build_common_metadata,
)
from ..features.database.source import SqlSourceBaseline, TableSeed


def quote_identifier(name: str) -> str:
    return SnowflakeDialect().identifier_preparer.quote_identifier(name)


def qualified_schema(database: str, schema: str) -> str:
    return f"{quote_identifier(database)}.{quote_identifier(schema)}"


# -----------------------------------------------------------------------------
# all_types: Snowflake-native types (exercises connector type mapping)
# -----------------------------------------------------------------------------


def _declare_all_types(md: MetaData) -> Table:
    return Table(
        "all_types",
        md,
        Column("id", sf.NUMBER(38, 0), primary_key=True, nullable=False, autoincrement=False),
        Column("number_col", sf.NUMBER(10, 2), nullable=True),
        Column("int_col", sf.INTEGER, nullable=True),
        Column("float_col", sf.FLOAT, nullable=True),
        Column("varchar_col", sf.VARCHAR(50), nullable=True),
        Column("char_col", sf.CHAR(3), nullable=True),
        Column("text_col", sf.TEXT, nullable=True),
        Column("bool_col", sf.BOOLEAN, nullable=True),
        Column("date_col", sf.DATE, nullable=True),
        Column("time_col", sf.TIME, nullable=True),
        Column("ts_ntz_col", sf.TIMESTAMP_NTZ, nullable=True),
        Column("ts_ltz_col", sf.TIMESTAMP_LTZ, nullable=True),
        Column("ts_tz_col", sf.TIMESTAMP_TZ, nullable=True),
        Column("binary_col", sf.BINARY, nullable=True),
        Column("variant_col", sf.VARIANT, nullable=True),
        Column("object_col", sf.OBJECT, nullable=True),
        Column("array_col", sf.ARRAY, nullable=True),
        Column("geography_col", sf.GEOGRAPHY, nullable=True),
    )


# Semi-structured and geospatial constructors are rejected inside a VALUES clause,
# so the rows are inserted through one SELECT ... UNION ALL statement.
_NATIVE_ROW = (
    "SELECT 1, 1234.56, 123456, 1.5, 'text value', 'abc', 'long text value', TRUE, "
    "'2026-01-02'::DATE, '12:34:56'::TIME, '2026-01-02 12:34:56'::TIMESTAMP_NTZ, "
    "'2026-01-02 12:34:56 +00:00'::TIMESTAMP_LTZ, '2026-01-02 12:34:56 +00:00'::TIMESTAMP_TZ, "
    "TO_BINARY('bytes value', 'UTF-8'), PARSE_JSON('{\"kind\": \"fixture\", \"count\": 2}'), "
    "OBJECT_CONSTRUCT('x', 7, 'y', 'seven'), ARRAY_CONSTRUCT('a', 'b'), TO_GEOGRAPHY('POINT(1 2)')"
)
_NULL_ROW = "SELECT {id}" + ", NULL" * 17


def build_snowflake_baseline(database: str, schema: str) -> SqlSourceBaseline:
    """Declare a fresh baseline for exactly one owned Snowflake schema."""
    quoted = qualified_schema(database, schema)
    metadata = build_common_metadata(schema)
    _declare_all_types(metadata)
    seeds = [TableSeed("customers", COMMON_CUSTOMER_ROWS), TableSeed("transactions", COMMON_TRANSACTION_ROWS)]
    ddl = [
        f"INSERT INTO {quoted}.all_types {_NATIVE_ROW} UNION ALL {_NULL_ROW.format(id=2)} UNION ALL {_NULL_ROW.format(id=3)}",
        f"""
        CREATE VIEW {quoted}.customer_txn_summary AS
        SELECT
            c.id AS customer_id,
            c.full_name,
            c.status AS customer_status,
            COUNT(t.id) AS txn_count,
            COALESCE(SUM(t.amount), 0) AS total_amount
        FROM {quoted}.customers c
        LEFT JOIN {quoted}.transactions t ON c.id = t.customer_id
        GROUP BY c.id, c.full_name, c.status
    """,
        f"""
        CREATE PROCEDURE {quoted}.sp_active_customer_count()
        RETURNS NUMBER
        LANGUAGE SQL
        AS $$
        BEGIN
            RETURN (SELECT COUNT(*) FROM {quoted}.customers WHERE status = 'active');
        END
        $$
    """,
        f"""
        CREATE FUNCTION {quoted}.fn_convert_amount(amount NUMBER(10, 2), rate NUMBER(10, 4))
        RETURNS NUMBER(20, 6)
        AS $$ amount * rate $$
    """,
    ]
    return SqlSourceBaseline(metadata=metadata, seeds=seeds, ddl=ddl)
