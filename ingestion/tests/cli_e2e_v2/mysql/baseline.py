#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL source baseline — exhaustive coverage of the connector's feature surface.

Three tables + one view + one stored procedure, sized small but breadth-first
across everything the MySQL connector can deterministically ingest:

  e2e.customers (10 rows)
      Exercises: PII auto-classification (email, phone, ssn, address, city,
      country, zipcode, first_name, last_name, full_name, date_of_birth),
      DQ enum (status), profiler numeric (age, credit_score), profiler string
      (email, full_name lengths), profiler date (joined_date, date_of_birth),
      nullable columns (bio, phone).

  e2e.transactions (10 rows)
      Exercises: foreign-key table lineage (customer_id → customers.id),
      profiler numeric stats (amount mean/stddev), profiler datetime
      (txn_at), CHAR vs VARCHAR distinction (currency CHAR(3),
      reference_number CHAR(12)), mediumtext (notes), nullable columns.
      ip_address VARCHAR exercises additional PII recognizers.

  e2e.all_types (3 rows)
      Exercises: every MySQL type → OM DataType mapping the connector
      supports. Covers all integer widths, float/double/decimal, char/
      varchar/all-text-variants, binary/varbinary/all-blob-variants,
      date/time/datetime/timestamp/year, bit, json, enum, set.
      3 rows chosen so .row_count().equals(3) assertion works alongside
      the 10-row tables.

  e2e.customer_txn_summary (view)
      Exercises: view-to-table lineage (derived from two tables).

  e2e.sp_active_customer_count (stored procedure)
      Exercises: StoredProcedure entity ingestion when
      includeStoredProcedures=True is passed to .as_metadata().

Determinism guarantees:
  - All seed SQL uses explicit literal values (no NOW(), RAND(), UUID()).
  - ON DUPLICATE KEY UPDATE for idempotent re-apply.
  - Fixed row counts: customers=10, transactions=10, all_types=3.
  - The procedure body is a static SELECT COUNT(*) WHERE status = 'active'.
"""

from __future__ import annotations

from functools import lru_cache

from ..core.config.env import Env
from ..core.source.orchestrator import EnforcementPolicy
from ..core.source.sql import (
    BaselineColumn,
    BaselineStoredProcedure,
    BaselineTable,
    BaselineView,
    Seed,
    SqlSourceBaseline,
)
from .enforcer import MySqlEnforcer


# -----------------------------------------------------------------------------
# customers — PII + DQ + profiler coverage (10 rows)
# -----------------------------------------------------------------------------

_CUSTOMERS = BaselineTable(
    schema="e2e",
    name="customers",
    columns=[
        BaselineColumn("id", "INT", nullable=False, primary_key=True),
        BaselineColumn("first_name", "VARCHAR(50)", nullable=False),
        BaselineColumn("last_name", "VARCHAR(50)", nullable=False),
        BaselineColumn("full_name", "VARCHAR(100)", nullable=False),
        BaselineColumn("email", "VARCHAR(255)", nullable=False),
        BaselineColumn("phone", "VARCHAR(20)", nullable=True),
        BaselineColumn("ssn", "VARCHAR(11)", nullable=True),
        BaselineColumn("address", "VARCHAR(255)", nullable=True),
        BaselineColumn("city", "VARCHAR(100)", nullable=True),
        BaselineColumn("country", "VARCHAR(100)", nullable=True),
        BaselineColumn("zipcode", "VARCHAR(20)", nullable=True),
        BaselineColumn("date_of_birth", "DATE", nullable=True),
        BaselineColumn("age", "INT", nullable=True),
        BaselineColumn("credit_score", "INT", nullable=True),
        BaselineColumn("status", "VARCHAR(20)", nullable=False),
        BaselineColumn("is_active", "TINYINT", nullable=False),
        BaselineColumn("bio", "TEXT", nullable=True),
        BaselineColumn("joined_date", "DATE", nullable=False),
    ],
    seed=Seed(
        sql="""
            INSERT INTO e2e.customers (
                id, first_name, last_name, full_name, email, phone, ssn,
                address, city, country, zipcode, date_of_birth, age,
                credit_score, status, is_active, bio, joined_date
            ) VALUES
                (1,  'Alice',   'Anderson',  'Alice Anderson',   'alice@test.com',   '555-0101', '111-11-1111',
                     '100 Main St',  'Springfield',  'USA',  '11111', '1990-01-15', 36, 720, 'active',   1,
                     'Loyal customer since 2026.',       '2026-01-01'),
                (2,  'Bob',     'Brown',     'Bob Brown',        'bob@test.com',     '555-0102', '222-22-2222',
                     '200 Oak Ave',  'Portland',     'USA',  '22222', '1985-03-20', 41, 680, 'active',   1,
                     NULL,                               '2026-01-02'),
                (3,  'Charlie', 'Chen',      'Charlie Chen',     'charlie@test.com', NULL,       '333-33-3333',
                     '300 Pine Rd',  'Seattle',      'USA',  '33333', '1992-06-10', 34, 650, 'inactive', 0,
                     'Churned in Q2 2026.',              '2026-01-03'),
                (4,  'Diana',   'Davis',     'Diana Davis',      'diana@test.com',   '555-0104', '444-44-4444',
                     '400 Elm St',   'Austin',       'USA',  '44444', '1988-11-02', 38, 750, 'active',   1,
                     'High-value account.',              '2026-01-04'),
                (5,  'Eve',     'Evans',     'Eve Evans',        'eve@test.com',     '555-0105', NULL,
                     '500 Birch Ln', 'Denver',       'USA',  '55555', '2000-05-25', 26, 600, 'pending',  1,
                     NULL,                               '2026-01-05'),
                (6,  'Frank',   'Foster',    'Frank Foster',     'frank@test.com',   '555-0106', '666-66-6666',
                     '600 Cedar Ct', 'Chicago',      'USA',  '66666', '1975-09-14', 51, 800, 'active',   1,
                     'Long-term account holder.',        '2026-01-06'),
                (7,  'Grace',   'Garcia',    'Grace Garcia',     'grace@test.com',   NULL,       '777-77-7777',
                     NULL,            'Miami',        'USA',  '77777', '1995-04-30', 31, 700, 'active',   1,
                     NULL,                               '2026-01-07'),
                (8,  'Henry',   'Harris',    'Henry Harris',     'henry@test.com',   '555-0108', NULL,
                     '800 Spruce Dr','Boston',       'USA',  '88888', '1982-07-08', 44, 720, 'inactive', 0,
                     'Requested deactivation.',          '2026-01-08'),
                (9,  'Iris',    'Ibrahim',   'Iris Ibrahim',     'iris@test.com',    '555-0109', '999-99-9999',
                     '900 Maple Way','Phoenix',      'USA',  '99999', '1998-12-22', 28, 690, 'pending',  1,
                     NULL,                               '2026-01-09'),
                (10, 'Jack',    'Johnson',   'Jack Johnson',     'jack@test.com',    '555-0110', '101-01-0101',
                     '1000 Ash Rd',  'Dallas',       'USA',  '10101', '1970-02-28', 56, 780, 'active',   1,
                     'Founding customer.',               '2026-01-10')
            ON DUPLICATE KEY UPDATE
                first_name = VALUES(first_name), last_name = VALUES(last_name),
                full_name = VALUES(full_name), email = VALUES(email),
                phone = VALUES(phone), ssn = VALUES(ssn),
                address = VALUES(address), city = VALUES(city),
                country = VALUES(country), zipcode = VALUES(zipcode),
                date_of_birth = VALUES(date_of_birth), age = VALUES(age),
                credit_score = VALUES(credit_score), status = VALUES(status),
                is_active = VALUES(is_active), bio = VALUES(bio),
                joined_date = VALUES(joined_date);
        """,
        expected_row_count=10,
    ),
)


# -----------------------------------------------------------------------------
# transactions — FK lineage + numeric profiler + CHAR/DATETIME coverage (10 rows)
# -----------------------------------------------------------------------------

_TRANSACTIONS = BaselineTable(
    schema="e2e",
    name="transactions",
    columns=[
        BaselineColumn("id", "BIGINT", nullable=False, primary_key=True),
        BaselineColumn("customer_id", "INT", nullable=False),
        BaselineColumn("amount", "DECIMAL(10,2)", nullable=False),
        BaselineColumn("currency", "CHAR(3)", nullable=False),
        BaselineColumn("exchange_rate", "DOUBLE", nullable=True),
        BaselineColumn("status", "VARCHAR(20)", nullable=False),
        BaselineColumn("txn_at", "DATETIME", nullable=False),
        BaselineColumn("reference_number", "CHAR(12)", nullable=False),
        BaselineColumn("ip_address", "VARCHAR(45)", nullable=True),
        BaselineColumn("notes", "MEDIUMTEXT", nullable=True),
    ],
    seed=Seed(
        sql="""
            INSERT INTO e2e.transactions (
                id, customer_id, amount, currency, exchange_rate, status,
                txn_at, reference_number, ip_address, notes
            ) VALUES
                (1,  1,  125.50,  'USD', 1.0000,  'completed', '2026-02-01 09:15:00', 'TXN000000001', '10.0.0.1',   'Monthly subscription renewal.'),
                (2,  1,   49.99,  'USD', 1.0000,  'completed', '2026-02-05 14:30:00', 'TXN000000002', '10.0.0.1',   NULL),
                (3,  2,  250.00,  'USD', 1.0000,  'completed', '2026-02-10 11:20:00', 'TXN000000003', '10.0.0.2',   'Premium upgrade.'),
                (4,  3,   19.99,  'USD', 1.0000,  'refunded',  '2026-02-12 16:45:00', 'TXN000000004', '10.0.0.3',   'Customer requested refund.'),
                (5,  4,  999.00,  'USD', 1.0000,  'completed', '2026-02-15 08:00:00', 'TXN000000005', '10.0.0.4',   'Enterprise tier annual.'),
                (6,  4,  125.50,  'EUR', 1.0850,  'completed', '2026-02-18 13:10:00', 'TXN000000006', '10.0.0.4',   NULL),
                (7,  6,   75.25,  'USD', 1.0000,  'completed', '2026-02-20 10:05:00', 'TXN000000007', '10.0.0.6',   NULL),
                (8,  7,  300.00,  'USD', 1.0000,  'pending',   '2026-02-22 15:30:00', 'TXN000000008', '10.0.0.7',   'Awaiting confirmation.'),
                (9,  10, 180.00,  'GBP', 0.7900,  'completed', '2026-02-25 12:00:00', 'TXN000000009', '10.0.0.10',  'GB wire transfer.'),
                (10, 10,  45.00,  'USD', 1.0000,  'failed',    '2026-02-28 17:25:00', 'TXN000000010', '10.0.0.10',  'Insufficient funds.')
            ON DUPLICATE KEY UPDATE
                customer_id = VALUES(customer_id), amount = VALUES(amount),
                currency = VALUES(currency), exchange_rate = VALUES(exchange_rate),
                status = VALUES(status), txn_at = VALUES(txn_at),
                reference_number = VALUES(reference_number),
                ip_address = VALUES(ip_address), notes = VALUES(notes);
        """,
        expected_row_count=10,
    ),
)


# -----------------------------------------------------------------------------
# all_types — every MySQL native type the connector maps (3 rows)
# -----------------------------------------------------------------------------

_ALL_TYPES = BaselineTable(
    schema="e2e",
    name="all_types",
    columns=[
        BaselineColumn("id", "INT", nullable=False, primary_key=True),
        # integer variants
        BaselineColumn("tiny_int_col", "TINYINT", nullable=True),
        BaselineColumn("small_int_col", "SMALLINT", nullable=True),
        BaselineColumn("medium_int_col", "MEDIUMINT", nullable=True),
        BaselineColumn("int_col", "INT", nullable=True),
        BaselineColumn("big_int_col", "BIGINT", nullable=True),
        # floating
        BaselineColumn("float_col", "FLOAT", nullable=True),
        BaselineColumn("double_col", "DOUBLE", nullable=True),
        BaselineColumn("decimal_col", "DECIMAL(10,2)", nullable=True),
        # string
        BaselineColumn("char_col", "CHAR(10)", nullable=True),
        BaselineColumn("varchar_col", "VARCHAR(255)", nullable=True),
        BaselineColumn("tinytext_col", "TINYTEXT", nullable=True),
        BaselineColumn("text_col", "TEXT", nullable=True),
        BaselineColumn("mediumtext_col", "MEDIUMTEXT", nullable=True),
        BaselineColumn("longtext_col", "LONGTEXT", nullable=True),
        # binary
        BaselineColumn("binary_col", "BINARY(16)", nullable=True),
        BaselineColumn("varbinary_col", "VARBINARY(255)", nullable=True),
        BaselineColumn("tinyblob_col", "TINYBLOB", nullable=True),
        BaselineColumn("blob_col", "BLOB", nullable=True),
        BaselineColumn("mediumblob_col", "MEDIUMBLOB", nullable=True),
        BaselineColumn("longblob_col", "LONGBLOB", nullable=True),
        # date/time
        BaselineColumn("date_col", "DATE", nullable=True),
        BaselineColumn("time_col", "TIME", nullable=True),
        BaselineColumn("datetime_col", "DATETIME", nullable=True),
        BaselineColumn("timestamp_col", "TIMESTAMP", nullable=True),
        BaselineColumn("year_col", "YEAR", nullable=True),
        # bit / json / enum / set
        BaselineColumn("bit_col", "BIT(8)", nullable=True),
        BaselineColumn("json_col", "JSON", nullable=True),
        BaselineColumn("enum_col", "ENUM('alpha','beta','gamma')", nullable=True),
        BaselineColumn("set_col", "SET('x','y','z')", nullable=True),
    ],
    seed=Seed(
        sql=r"""
            INSERT INTO e2e.all_types (
                id, tiny_int_col, small_int_col, medium_int_col, int_col, big_int_col,
                float_col, double_col, decimal_col,
                char_col, varchar_col, tinytext_col, text_col, mediumtext_col, longtext_col,
                binary_col, varbinary_col, tinyblob_col, blob_col, mediumblob_col, longblob_col,
                date_col, time_col, datetime_col, timestamp_col, year_col,
                bit_col, json_col, enum_col, set_col
            ) VALUES
                (1,
                 1, 100, 10000, 1000000, 10000000000,
                 1.5, 3.141592653589793, 99.99,
                 'abc',  'varchar row 1',  'tiny text 1',  'text row 1',  'medium text 1',  'long text 1',
                 X'00112233445566778899AABBCCDDEEFF', X'DEADBEEF',
                 X'0102', X'0304', X'0506', X'0708',
                 '2026-01-01', '00:00:01', '2026-01-01 00:00:01', '2026-01-01 00:00:01', 2020,
                 b'00000001', JSON_OBJECT('k', 'v', 'n', 1), 'alpha', 'x,y'),
                (2,
                 0, 0, 0, 0, 0,
                 0.0, 0.0, 0.00,
                 'def',  'varchar row 2',  'tiny text 2',  'text row 2',  'medium text 2',  'long text 2',
                 X'FFEEDDCCBBAA99887766554433221100', X'CAFEBABE',
                 X'0A0B', X'0C0D', X'0E0F', X'1011',
                 '2026-06-15', '12:30:45', '2026-06-15 12:30:45', '2026-06-15 12:30:45', 2026,
                 b'00010000', JSON_OBJECT('k', 'v2'),         'beta',  'y,z'),
                (3,
                 -1, -100, -10000, -1000000, -10000000000,
                 -1.5, -3.141592653589793, -99.99,
                 'ghi',  'varchar row 3',  'tiny text 3',  'text row 3',  'medium text 3',  'long text 3',
                 X'01020304050607080910111213141516', X'BAADF00D',
                 X'AABB', X'CCDD', X'EEFF', X'1234',
                 '2026-12-31', '23:59:59', '2026-12-31 23:59:59', '2026-12-31 23:59:59', 2030,
                 b'11111111', JSON_ARRAY(1, 2, 3),            'gamma', 'x,z')
            ON DUPLICATE KEY UPDATE
                tiny_int_col = VALUES(tiny_int_col), small_int_col = VALUES(small_int_col),
                medium_int_col = VALUES(medium_int_col), int_col = VALUES(int_col),
                big_int_col = VALUES(big_int_col), float_col = VALUES(float_col),
                double_col = VALUES(double_col), decimal_col = VALUES(decimal_col),
                char_col = VALUES(char_col), varchar_col = VALUES(varchar_col),
                tinytext_col = VALUES(tinytext_col), text_col = VALUES(text_col),
                mediumtext_col = VALUES(mediumtext_col), longtext_col = VALUES(longtext_col),
                binary_col = VALUES(binary_col), varbinary_col = VALUES(varbinary_col),
                tinyblob_col = VALUES(tinyblob_col), blob_col = VALUES(blob_col),
                mediumblob_col = VALUES(mediumblob_col), longblob_col = VALUES(longblob_col),
                date_col = VALUES(date_col), time_col = VALUES(time_col),
                datetime_col = VALUES(datetime_col), timestamp_col = VALUES(timestamp_col),
                year_col = VALUES(year_col), bit_col = VALUES(bit_col),
                json_col = VALUES(json_col), enum_col = VALUES(enum_col),
                set_col = VALUES(set_col);
        """,
        expected_row_count=3,
    ),
)


# -----------------------------------------------------------------------------
# customer_txn_summary — view-to-table lineage
# -----------------------------------------------------------------------------

_CUSTOMER_TXN_SUMMARY = BaselineView(
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


# -----------------------------------------------------------------------------
# sp_active_customer_count — stored procedure
# -----------------------------------------------------------------------------

_SP_ACTIVE_CUSTOMER_COUNT = BaselineStoredProcedure(
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


# -----------------------------------------------------------------------------
# Top-level baseline
# -----------------------------------------------------------------------------

MYSQL_BASELINE = SqlSourceBaseline(
    schemas=["e2e"],
    tables=[_CUSTOMERS, _TRANSACTIONS, _ALL_TYPES],
    views=[_CUSTOMER_TXN_SUMMARY],
    stored_procedures=[_SP_ACTIVE_CUSTOMER_COUNT],
)


# -----------------------------------------------------------------------------
# Policy factory
# -----------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_policy() -> EnforcementPolicy:
    """Lazy-build and cache the MySQL EnforcementPolicy.

    Reads E2E_MYSQL_* env vars on first call. EnvLoadError surfaces at
    fixture time with a clear message when a required var is missing —
    better than opaque failures deeper in the pipeline.
    """
    user = Env("E2E_MYSQL_USER").get()
    password = Env("E2E_MYSQL_PASSWORD").get()
    host_port = Env("E2E_MYSQL_HOST_PORT").get()
    url = f"mysql+pymysql://{user}:{password}@{host_port}"
    enforcer = MySqlEnforcer.from_url(url, MYSQL_BASELINE)
    return EnforcementPolicy(enforcer=enforcer, mode="apply")
