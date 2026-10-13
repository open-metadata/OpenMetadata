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
"""Oracle-native tables, seeds, views and procedures in one owned schema.

Identifiers are declared lowercase. SQLAlchemy emits them unquoted, Oracle folds
them to uppercase in the data dictionary, and the Oracle source normalises them
back to lowercase unless ``preserveIdentifierCase`` is set — which this suite
deliberately leaves at its default. Declared names therefore match the expected
catalog literally, and no case-insensitive filter patterns are needed.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Column, Integer, MetaData, Table
from sqlalchemy.dialects import oracle

from ..features.database.common_baseline import (
    COMMON_CUSTOMER_ROWS,
    COMMON_TRANSACTION_ROWS,
    build_common_metadata,
)
from ..features.database.source import SqlSourceBaseline, TableSeed

# -----------------------------------------------------------------------------
# all_types — Oracle-specific native types (exercises connector type mapping)
# -----------------------------------------------------------------------------


def _declare_all_types(md: MetaData) -> Table:
    return Table(
        "all_types",
        md,
        Column("id", Integer, primary_key=True, nullable=False),
        # NUMBER with and without scale: Oracle's single numeric type.
        Column("number_int_col", oracle.NUMBER(9), nullable=True),
        Column("number_big_col", oracle.NUMBER(19), nullable=True),
        Column("number_decimal_col", oracle.NUMBER(10, 2), nullable=True),
        Column("float_col", oracle.FLOAT, nullable=True),
        Column("binary_float_col", oracle.BINARY_FLOAT, nullable=True),
        Column("binary_double_col", oracle.BINARY_DOUBLE, nullable=True),
        # Character types, byte- and national-semantics.
        Column("char_col", oracle.CHAR(10), nullable=True),
        Column("nchar_col", oracle.NCHAR(10), nullable=True),
        Column("varchar2_col", oracle.VARCHAR2(255), nullable=True),
        Column("nvarchar2_col", oracle.NVARCHAR2(255), nullable=True),
        Column("clob_col", oracle.CLOB, nullable=True),
        Column("nclob_col", oracle.NCLOB, nullable=True),
        # Binary.
        Column("raw_col", oracle.RAW(16), nullable=True),
        Column("blob_col", oracle.BLOB, nullable=True),
        # Temporal. Oracle DATE carries a time component; TIMESTAMP adds fractional seconds.
        Column("date_col", oracle.DATE, nullable=True),
        Column("timestamp_col", oracle.TIMESTAMP, nullable=True),
        Column("timestamp_tz_col", oracle.TIMESTAMP(timezone=True), nullable=True),
    )


_NATIVE_VALUES: dict[str, Any] = {
    "number_int_col": 123456,
    "number_big_col": 9000000000,
    "number_decimal_col": Decimal("1234.56"),
    "float_col": 1.5,
    "binary_float_col": 2.5,
    "binary_double_col": 3.25,
    "char_col": "fixed",
    "nchar_col": "nfixed",
    "varchar2_col": "variable",
    "nvarchar2_col": "nvariable",
    "clob_col": "clob value",
    "nclob_col": "nclob value",
    "raw_col": b"0123456789abcdef",
    "blob_col": b"blob value",
    "date_col": datetime(2026, 1, 2, 12, 34, 56),
    "timestamp_col": datetime(2026, 1, 2, 12, 34, 56),
    "timestamp_tz_col": datetime(2026, 1, 2, 12, 34, 56),
}


def build_oracle_baseline(schema: str) -> SqlSourceBaseline:
    """Declare a fresh baseline for exactly one Oracle schema (an Oracle user)."""
    # Emitted unquoted, exactly as SQLAlchemy emits the all-lowercase table names, so
    # Oracle folds schema and object names the same way. Quoting the schema here would
    # look for a lowercase user that CREATE USER never created.
    metadata = build_common_metadata(schema)
    metadata.tables[f"{schema}.transactions"].c.customer_id.comment = f"FK referencing {schema}.customers.id."
    _declare_all_types(metadata)
    rows = [
        {"id": 1, **_NATIVE_VALUES},
        {"id": 2, **dict.fromkeys(_NATIVE_VALUES)},
        {"id": 3, **dict.fromkeys(_NATIVE_VALUES)},
    ]
    seeds = [
        TableSeed("customers", COMMON_CUSTOMER_ROWS),
        TableSeed("transactions", COMMON_TRANSACTION_ROWS),
        TableSeed("all_types", rows),
    ]

    ddl = [
        # Columns are projected explicitly so the view carries real column-level lineage;
        # `SELECT *` would not.
        f"""
        CREATE VIEW {schema}.customer_txn_summary AS
        SELECT
            c.id AS customer_id,
            c.full_name,
            c.status AS customer_status,
            COUNT(t.id) AS txn_count,
            COALESCE(SUM(t.amount), 0) AS total_amount
        FROM {schema}.customers c
        LEFT JOIN {schema}.transactions t ON c.id = t.customer_id
        GROUP BY c.id, c.full_name, c.status
        """,
        f"""
        CREATE PROCEDURE {schema}.sp_active_customer_count(p_count OUT NUMBER) AS
        BEGIN
            SELECT COUNT(*) INTO p_count
            FROM {schema}.customers
            WHERE status = 'active';
        END;
        """,
        f"""
        CREATE PROCEDURE {schema}.sp_update_customer_status(
            p_customer_id IN NUMBER,
            p_status IN VARCHAR2
        ) AS
        BEGIN
            UPDATE {schema}.customers
            SET status = p_status
            WHERE id = p_customer_id;
        END;
        """,
    ]
    return SqlSourceBaseline(metadata=metadata, seeds=seeds, ddl=ddl)
