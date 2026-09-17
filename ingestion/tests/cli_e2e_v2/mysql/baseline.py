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
"""MySQL-native tables, seeds, views and procedures in an explicit schema."""

from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    Float,
    Integer,
    MetaData,
    Numeric,
    SmallInteger,
    Table,
    Time,
)
from sqlalchemy.dialects import mysql

from ..features.database.common_baseline import (
    COMMON_CUSTOMER_ROWS,
    COMMON_TRANSACTION_ROWS,
    build_common_metadata,
)
from ..features.database.source import (
    SqlSourceBaseline,
    StoredProcedureDefinition,
    TableSeed,
    ViewDefinition,
)

# -----------------------------------------------------------------------------
# all_types — MySQL-specific native types (exercises connector type mapping)
# -----------------------------------------------------------------------------


def _declare_all_types(md: MetaData) -> Table:
    return Table(
        "all_types",
        md,
        Column("id", Integer, primary_key=True, nullable=False),
        Column("tiny_int_col", mysql.TINYINT, nullable=True),
        Column("small_int_col", SmallInteger, nullable=True),
        Column("medium_int_col", mysql.MEDIUMINT, nullable=True),
        Column("int_col", Integer, nullable=True),
        Column("big_int_col", BigInteger, nullable=True),
        Column("float_col", Float, nullable=True),
        Column("double_col", mysql.DOUBLE, nullable=True),
        Column("decimal_col", Numeric(10, 2), nullable=True),
        Column("char_col", mysql.CHAR(10), nullable=True),
        Column("varchar_col", mysql.VARCHAR(255), nullable=True),
        Column("tinytext_col", mysql.TINYTEXT, nullable=True),
        Column("text_col", mysql.TEXT, nullable=True),
        Column("mediumtext_col", mysql.MEDIUMTEXT, nullable=True),
        Column("longtext_col", mysql.LONGTEXT, nullable=True),
        Column("binary_col", mysql.BINARY(16), nullable=True),
        Column("varbinary_col", mysql.VARBINARY(255), nullable=True),
        Column("tinyblob_col", mysql.TINYBLOB, nullable=True),
        Column("blob_col", mysql.BLOB, nullable=True),
        Column("mediumblob_col", mysql.MEDIUMBLOB, nullable=True),
        Column("longblob_col", mysql.LONGBLOB, nullable=True),
        Column("date_col", Date, nullable=True),
        Column("time_col", Time, nullable=True),
        Column("datetime_col", DateTime, nullable=True),
        Column("timestamp_col", mysql.TIMESTAMP, nullable=True),
        Column("year_col", mysql.YEAR, nullable=True),
        Column("bit_col", mysql.BIT(8), nullable=True),
        Column("json_col", mysql.JSON, nullable=True),
        Column("enum_col", mysql.ENUM("alpha", "beta", "gamma"), nullable=True),
        Column("set_col", mysql.SET("x", "y", "z"), nullable=True),
    )


_NATIVE_VALUES: dict[str, Any] = {
    "tiny_int_col": -12,
    "small_int_col": 1234,
    "medium_int_col": 70000,
    "int_col": 123456,
    "big_int_col": 9000000000,
    "float_col": 1.5,
    "double_col": 2.25,
    "decimal_col": Decimal("1234.56"),
    "char_col": "fixed",
    "varchar_col": "variable",
    "tinytext_col": "tiny text",
    "text_col": "text value",
    "mediumtext_col": "medium text",
    "longtext_col": "long text",
    "binary_col": b"0123456789abcdef",
    "varbinary_col": b"variable bytes",
    "tinyblob_col": b"tiny blob",
    "blob_col": b"blob value",
    "mediumblob_col": b"medium blob",
    "longblob_col": b"long blob",
    "date_col": date(2026, 1, 2),
    "time_col": time(12, 34, 56),
    "datetime_col": datetime(2026, 1, 2, 12, 34, 56),
    "timestamp_col": datetime(2026, 1, 2, 12, 34, 56),
    "year_col": 2026,
    "bit_col": 5,
    "json_col": {"kind": "fixture", "count": 2},
    "enum_col": "beta",
    "set_col": {"x", "z"},
}


def build_mysql_baseline(schema: str) -> SqlSourceBaseline:
    """Declare a fresh baseline for exactly one MySQL schema."""
    quoted = mysql.dialect().identifier_preparer.quote_identifier(schema)
    metadata = build_common_metadata(schema)
    metadata.tables[f"{schema}.transactions"].c.customer_id.comment = f"FK referencing {schema}.customers.id."
    _declare_all_types(metadata)
    rows = [
        {"id": 1, **_NATIVE_VALUES},
        {"id": 2, **dict.fromkeys(_NATIVE_VALUES)},
        {"id": 3, **dict.fromkeys(_NATIVE_VALUES)},
    ]
    seeds = []
    for name, values in (
        ("customers", COMMON_CUSTOMER_ROWS),
        ("transactions", COMMON_TRANSACTION_ROWS),
        ("all_types", rows),
    ):
        seeds.append(TableSeed(name, values))

    view = ViewDefinition(
        schema=schema,
        name="customer_txn_summary",
        definition_sql=f"""
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
    )
    active_count = StoredProcedureDefinition(
        schema=schema,
        name="sp_active_customer_count",
        definition_sql=f"""
        CREATE PROCEDURE {quoted}.sp_active_customer_count()
        BEGIN
            SELECT COUNT(*) AS active_count
            FROM {quoted}.customers
            WHERE status = 'active';
        END
    """,
    )
    update_status = StoredProcedureDefinition(
        schema=schema,
        name="sp_update_customer_status",
        definition_sql=f"""
        CREATE PROCEDURE {quoted}.sp_update_customer_status(
            IN p_customer_id INT,
            IN p_status VARCHAR(20)
        )
        BEGIN
            UPDATE {quoted}.customers
            SET status = p_status
            WHERE id = p_customer_id;
        END
    """,
    )
    return SqlSourceBaseline(
        schemas=[schema],
        metadata=metadata,
        seeds=seeds,
        views=[view],
        stored_procedures=[active_count, update_status],
    )
