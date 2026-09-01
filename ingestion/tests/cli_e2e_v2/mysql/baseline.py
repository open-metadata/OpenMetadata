#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL source baseline — common portable tables + MySQL-specific all_types.

- Common tables (customers, transactions) and seed rows from `core/source/common_baseline.py`.
- Dialect-specific `all_types` table covering MySQL native types for connector type-mapping coverage.
- INSERT templates use `ON DUPLICATE KEY UPDATE` for idempotent seeding.
- One view and two stored procedures for lineage and SP-ingestion coverage.
"""

from __future__ import annotations

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

from ..core.source.common_baseline import (
    COMMON_CUSTOMER_ROWS,
    COMMON_TRANSACTION_ROWS,
    build_common_metadata,
)
from ..core.source.sql import (
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


# One row per id, all other columns NULL — tests assert row count and type mappings only.
_ALL_TYPES_ROWS: list[dict[str, Any]] = [{"id": 1}, {"id": 2}, {"id": 3}]


# -----------------------------------------------------------------------------
# Dialect-specific INSERT templates (MySQL `ON DUPLICATE KEY UPDATE` idempotency)
# -----------------------------------------------------------------------------


_MYSQL_CUSTOMERS_INSERT = """
INSERT INTO e2e.customers
    (id, first_name, last_name, full_name, email,
     address, city, country, zipcode, date_of_birth, age,
     credit_score, status, is_active, bio, joined_date)
VALUES
    (:id, :first_name, :last_name, :full_name, :email,
     :address, :city, :country, :zipcode, :date_of_birth, :age,
     :credit_score, :status, :is_active, :bio, :joined_date)
ON DUPLICATE KEY UPDATE
    first_name = VALUES(first_name), last_name = VALUES(last_name),
    full_name = VALUES(full_name), email = VALUES(email),
    address = VALUES(address), city = VALUES(city),
    country = VALUES(country), zipcode = VALUES(zipcode),
    date_of_birth = VALUES(date_of_birth), age = VALUES(age),
    credit_score = VALUES(credit_score), status = VALUES(status),
    is_active = VALUES(is_active), bio = VALUES(bio),
    joined_date = VALUES(joined_date)
"""

_MYSQL_TRANSACTIONS_INSERT = """
INSERT INTO e2e.transactions
    (id, customer_id, amount, currency, exchange_rate, status,
     txn_at, reference_number, ip_address, notes)
VALUES
    (:id, :customer_id, :amount, :currency, :exchange_rate, :status,
     :txn_at, :reference_number, :ip_address, :notes)
ON DUPLICATE KEY UPDATE
    customer_id = VALUES(customer_id), amount = VALUES(amount),
    currency = VALUES(currency), exchange_rate = VALUES(exchange_rate),
    status = VALUES(status), txn_at = VALUES(txn_at),
    reference_number = VALUES(reference_number),
    ip_address = VALUES(ip_address), notes = VALUES(notes)
"""

_MYSQL_ALL_TYPES_INSERT = """
INSERT INTO e2e.all_types (id) VALUES (:id)
ON DUPLICATE KEY UPDATE id = VALUES(id)
"""


# -----------------------------------------------------------------------------
# View + stored procedure (dialect-specific DDL)
# -----------------------------------------------------------------------------


_CUSTOMER_TXN_SUMMARY_VIEW = ViewDefinition(
    schema="e2e",
    name="customer_txn_summary",
    definition_sql="""
        CREATE OR REPLACE VIEW e2e.customer_txn_summary AS
        SELECT
            c.id AS customer_id,
            c.full_name,
            c.status AS customer_status,
            COUNT(t.id) AS txn_count,
            COALESCE(SUM(t.amount), 0) AS total_amount
        FROM e2e.customers c
        LEFT JOIN e2e.transactions t ON c.id = t.customer_id
        GROUP BY c.id, c.full_name, c.status
    """,
)


_SP_ACTIVE_CUSTOMER_COUNT = StoredProcedureDefinition(
    schema="e2e",
    name="sp_active_customer_count",
    definition_sql="""
        CREATE PROCEDURE e2e.sp_active_customer_count()
        BEGIN
            SELECT COUNT(*) AS active_count
            FROM e2e.customers
            WHERE status = 'active';
        END
    """,
)


# Parameterized SP with DML body — exercises the UPDATE code path in stored-procedure ingestion.
_SP_UPDATE_CUSTOMER_STATUS = StoredProcedureDefinition(
    schema="e2e",
    name="sp_update_customer_status",
    definition_sql="""
        CREATE PROCEDURE e2e.sp_update_customer_status(
            IN p_customer_id INT,
            IN p_status VARCHAR(20)
        )
        BEGIN
            UPDATE e2e.customers
            SET status = p_status
            WHERE id = p_customer_id;
        END
    """,
)


# -----------------------------------------------------------------------------
# Top-level baseline
# -----------------------------------------------------------------------------


def _build_metadata() -> MetaData:
    """Common portable tables + MySQL-specific all_types."""
    md = build_common_metadata("e2e")
    _declare_all_types(md)
    return md


MYSQL_BASELINE = SqlSourceBaseline(
    schemas=["e2e"],
    metadata=_build_metadata(),
    seeds=[
        TableSeed(
            table_name="customers",
            rows=COMMON_CUSTOMER_ROWS,
            insert_sql=_MYSQL_CUSTOMERS_INSERT,
        ),
        TableSeed(
            table_name="transactions",
            rows=COMMON_TRANSACTION_ROWS,
            insert_sql=_MYSQL_TRANSACTIONS_INSERT,
        ),
        TableSeed(
            table_name="all_types",
            rows=_ALL_TYPES_ROWS,
            insert_sql=_MYSQL_ALL_TYPES_INSERT,
        ),
    ],
    views=[_CUSTOMER_TXN_SUMMARY_VIEW],
    stored_procedures=[_SP_ACTIVE_CUSTOMER_COUNT, _SP_UPDATE_CUSTOMER_STATUS],
)
