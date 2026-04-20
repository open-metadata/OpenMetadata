#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL source baseline — declarative pre-ingestion source state.

Two tables and one view, sized to exercise every major connector feature
while staying as small as possible:

  e2e.customers (10 rows)
      Columns: INT PK, VARCHAR, VARCHAR (email — PII), VARCHAR (phone — PII),
               INT (age, credit_score — profiler numeric), TEXT nullable (bio),
               VARCHAR (status — DQ enum), DATE, TINYINT (boolean-like).
      Features exercised:
        - Schema / table / column discovery
        - Profiler: numeric (age, credit_score), string (email, full_name),
          nullable (phone, bio), date (joined_date)
        - Auto-classification: email column triggers PII tagger
        - Data quality: age > 0, status IN (...), email LIKE '%@%'

  e2e.transactions (10 rows)
      Columns: INT PK, INT FK→customers.id, DECIMAL(10,2), VARCHAR(3),
               VARCHAR (status), DATETIME, VARCHAR nullable.
      FK constraint declared so OM reads INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      and builds join-lineage between transactions → customers.
      Features exercised:
        - Table-to-table lineage via FK
        - Profiler: mean/stddev on amount, date range on txn_at
        - Data quality: amount > 0, status IN ('completed', 'refunded', ...)

  e2e.customer_txn_summary (view)
      LEFT JOIN of customers + transactions, grouped by customer.
      Features exercised:
        - View-to-table lineage: OM traces view columns back to source tables

Seed SQL uses ON DUPLICATE KEY UPDATE for full idempotency. Explicit timestamp
literals (no NOW()) give deterministic values that profiler min/max assertions
and DQ value checks can rely on.

get_policy() uses functools.lru_cache — no mutable module-level state. Env vars
are read only on the first call; subsequent calls return the cached
EnforcementPolicy instance.
"""

from __future__ import annotations

import functools

from tests.cli_e2e_v2.core.config.env import Env
from tests.cli_e2e_v2.core.source.orchestrator import EnforcementPolicy
from tests.cli_e2e_v2.core.source.sql import (
    BaselineColumn,
    BaselineTable,
    BaselineView,
    Seed,
    SqlSourceBaseline,
)
from tests.cli_e2e_v2.mysql.enforcer import MySqlEnforcer

_CUSTOMERS_SEED = """
    INSERT INTO e2e.customers
        (id, full_name, email, phone, age, credit_score, bio, status, joined_date, is_active)
    VALUES
        (1,  'Alice Andersen',  'alice@example.com',   '+1-555-0101', 34, 720, 'Premium member since 2022.',   'active',    '2022-03-15', 1),
        (2,  'Bob Bergman',     'bob@example.com',     '+1-555-0102', 28, 680, NULL,                           'active',    '2023-01-10', 1),
        (3,  'Carol Chen',      'carol@example.com',   '+1-555-0103', 45, 750, 'High-value account.',          'active',    '2021-06-20', 1),
        (4,  'David Diaz',      'david@example.com',   NULL,          52, 610, NULL,                           'inactive',  '2020-11-05', 0),
        (5,  'Eva Eriksen',     'eva@example.com',     '+1-555-0105', 31, 700, 'Referred by Carol.',           'active',    '2023-07-01', 1),
        (6,  'Frank Fischer',   'frank@example.com',   '+1-555-0106', 60, 640, NULL,                           'suspended', '2019-09-14', 0),
        (7,  'Grace Gomez',     'grace@example.com',   '+1-555-0107', 27, 780, 'New platinum tier.',           'active',    '2024-02-28', 1),
        (8,  'Hiro Hashimoto',  'hiro@example.com',    NULL,          38, 690, NULL,                           'active',    '2022-08-17', 1),
        (9,  'Iris Ivanova',    'iris@example.com',    '+1-555-0109', 43, 730, 'Renewed contract 2025.',       'active',    '2023-12-01', 1),
        (10, 'Jake Johnson',    'jake@example.com',    '+1-555-0110', 24, 590, NULL,                           'inactive',  '2024-05-19', 0)
    ON DUPLICATE KEY UPDATE
        full_name    = VALUES(full_name),
        email        = VALUES(email),
        phone        = VALUES(phone),
        age          = VALUES(age),
        credit_score = VALUES(credit_score),
        bio          = VALUES(bio),
        status       = VALUES(status),
        joined_date  = VALUES(joined_date),
        is_active    = VALUES(is_active);
"""

_TRANSACTIONS_SEED = """
    INSERT INTO e2e.transactions
        (id, customer_id, amount, currency, status, txn_at, description)
    VALUES
        (1,  1,  125.50,  'USD', 'completed', '2026-01-05 09:15:00', 'Online purchase'),
        (2,  1,  42.00,   'USD', 'completed', '2026-01-12 14:30:00', 'Subscription renewal'),
        (3,  2,  980.00,  'USD', 'completed', '2026-01-08 11:00:00', 'Hardware order'),
        (4,  3,  15.99,   'USD', 'refunded',  '2026-01-10 16:45:00', 'App store charge'),
        (5,  3,  250.00,  'USD', 'completed', '2026-01-15 08:20:00', 'Consulting fee'),
        (6,  5,  75.25,   'EUR', 'pending',   '2026-01-20 10:10:00', 'International wire'),
        (7,  6,  500.00,  'USD', 'failed',    '2026-01-22 13:55:00', 'Card declined'),
        (8,  7,  1200.00, 'USD', 'completed', '2026-01-25 17:00:00', 'Annual plan upgrade'),
        (9,  9,  33.49,   'USD', 'completed', '2026-01-28 09:45:00', 'Add-on purchase'),
        (10, 10, 89.99,   'USD', 'refunded',  '2026-01-30 12:30:00', 'Return processing')
    ON DUPLICATE KEY UPDATE
        customer_id = VALUES(customer_id),
        amount      = VALUES(amount),
        currency    = VALUES(currency),
        status      = VALUES(status),
        txn_at      = VALUES(txn_at),
        description = VALUES(description);
"""

_CUSTOMER_TXN_SUMMARY_VIEW = """
    CREATE OR REPLACE VIEW e2e.customer_txn_summary AS
    SELECT
        c.id          AS customer_id,
        c.full_name,
        c.email,
        c.status      AS customer_status,
        COUNT(t.id)   AS total_transactions,
        SUM(t.amount) AS total_spent,
        MAX(t.txn_at) AS last_transaction_at
    FROM e2e.customers c
    LEFT JOIN e2e.transactions t
        ON t.customer_id = c.id
       AND t.status = 'completed'
    GROUP BY c.id, c.full_name, c.email, c.status;
"""

MYSQL_BASELINE = SqlSourceBaseline(
    schemas=["e2e"],
    tables=[
        BaselineTable(
            schema="e2e",
            name="customers",
            columns=[
                BaselineColumn("id", "INT", nullable=False, primary_key=True),
                BaselineColumn("full_name", "VARCHAR(255)", nullable=False),
                BaselineColumn("email", "VARCHAR(255)", nullable=False),
                BaselineColumn("phone", "VARCHAR(20)", nullable=True),
                BaselineColumn("age", "INT", nullable=False),
                BaselineColumn("credit_score", "INT", nullable=False),
                BaselineColumn("bio", "TEXT", nullable=True),
                BaselineColumn("status", "VARCHAR(20)", nullable=False),
                BaselineColumn("joined_date", "DATE", nullable=False),
                BaselineColumn("is_active", "TINYINT", nullable=False),
            ],
            seed=Seed(sql=_CUSTOMERS_SEED, expected_row_count=10),
        ),
        BaselineTable(
            schema="e2e",
            name="transactions",
            columns=[
                BaselineColumn("id", "INT", nullable=False, primary_key=True),
                # FK to customers.id — OM reads INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                # for this constraint and builds join-level lineage.
                BaselineColumn("customer_id", "INT", nullable=False),
                BaselineColumn("amount", "DECIMAL(10,2)", nullable=False),
                BaselineColumn("currency", "VARCHAR(3)", nullable=False),
                BaselineColumn("status", "VARCHAR(20)", nullable=False),
                BaselineColumn("txn_at", "DATETIME", nullable=False),
                BaselineColumn("description", "VARCHAR(255)", nullable=True),
            ],
            seed=Seed(sql=_TRANSACTIONS_SEED, expected_row_count=10),
        ),
    ],
    views=[
        BaselineView(
            schema="e2e",
            name="customer_txn_summary",
            definition_sql=_CUSTOMER_TXN_SUMMARY_VIEW,
        ),
    ],
)


@functools.lru_cache(maxsize=1)
def get_policy() -> EnforcementPolicy:
    """Build and cache the MySQL EnforcementPolicy (lazy, called once per session).

    lru_cache(maxsize=1) is the singleton mechanism — no mutable module-level
    state. Env vars are read only on the first call; subsequent calls return the
    cached EnforcementPolicy. EnvLoadError on a missing variable surfaces at
    fixture time with a clear message pointing at the missing key.
    """
    user = Env.required("E2E_MYSQL_USER")
    password = Env.required("E2E_MYSQL_PASSWORD")
    host_port = Env.required("E2E_MYSQL_HOST_PORT")
    url = f"mysql+pymysql://{user}:{password}@{host_port}"
    enforcer = MySqlEnforcer.from_url(url, MYSQL_BASELINE)
    return EnforcementPolicy(enforcer=enforcer, mode="apply")
