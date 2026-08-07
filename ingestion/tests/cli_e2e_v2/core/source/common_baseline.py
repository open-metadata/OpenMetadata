#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Portable baseline shared across SQL dialects: common MetaData and seed rows.

- `build_common_metadata(schema)` returns a MetaData with `customers` and
  `transactions` tables; connector baselines may add dialect-specific tables.
- `COMMON_CUSTOMER_ROWS` / `COMMON_TRANSACTION_ROWS` are the portable seeds;
  each connector baseline wraps them in a `TableSeed` with a dialect-specific
  `insert_sql` template.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CHAR,
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    Text,
)


def build_common_metadata(schema: str = "e2e") -> MetaData:
    """Build a MetaData carrying portable tables (customers, transactions).

    Connector baselines call this and may add dialect-specific tables to the
    returned object before handing it to `SqlSourceBaseline`.
    """
    md = MetaData(schema=schema)

    Table(
        "customers",
        md,
        Column("id", Integer, primary_key=True, nullable=False, comment="Primary key identifying the customer."),
        Column("first_name", String(50), nullable=False, comment="Customer first name."),
        Column("last_name", String(50), nullable=False),
        Column("full_name", String(100), nullable=False),
        Column("email", String(255), nullable=False, comment="Customer email address."),
        Column("address", String(255), nullable=True),
        Column("city", String(100), nullable=True),
        Column("country", String(100), nullable=True),
        Column("zipcode", String(20), nullable=True),
        Column("date_of_birth", Date, nullable=True),
        Column("age", Integer, nullable=True),
        Column("credit_score", Integer, nullable=True),
        Column("status", String(20), nullable=False),
        Column("is_active", Boolean, nullable=False),
        Column("bio", Text, nullable=True),
        Column("joined_date", Date, nullable=False),
        comment="Customer master table used by CLI E2E v2 MySQL pilot.",
    )

    Table(
        "transactions",
        md,
        Column("id", BigInteger, primary_key=True, nullable=False),
        Column(
            "customer_id",
            Integer,
            ForeignKey(f"{schema}.customers.id"),
            nullable=False,
            comment="FK referencing e2e.customers.id.",
        ),
        Column("amount", Numeric(10, 2), nullable=False, comment="Transaction amount in the ticker currency."),
        Column("currency", CHAR(3), nullable=False),
        Column("exchange_rate", Numeric(10, 4), nullable=True),
        Column("status", String(20), nullable=False),
        Column("txn_at", DateTime, nullable=False),
        Column("reference_number", CHAR(12), nullable=False),
        Column("ip_address", String(45), nullable=True),
        Column("notes", Text, nullable=True),
        comment="Customer transaction events with FK to customers.id.",
    )

    return md


# -----------------------------------------------------------------------------
# Seed data — portable Python values. Dialects bind via :key placeholders.
# -----------------------------------------------------------------------------

COMMON_CUSTOMER_ROWS: list[dict[str, Any]] = [
    {
        "id": 1,
        "first_name": "Alice",
        "last_name": "Anderson",
        "full_name": "Alice Anderson",
        "email": "alice@test.com",
        "address": "100 Main St",
        "city": "Springfield",
        "country": "USA",
        "zipcode": "11111",
        "date_of_birth": date(1990, 1, 15),
        "age": 36,
        "credit_score": 720,
        "status": "active",
        "is_active": True,
        "bio": "Loyal customer since 2026.",
        "joined_date": date(2026, 1, 1),
    },
    {
        "id": 2,
        "first_name": "Bob",
        "last_name": "Brown",
        "full_name": "Bob Brown",
        "email": "bob@test.com",
        "address": "200 Oak Ave",
        "city": "Portland",
        "country": "USA",
        "zipcode": "22222",
        "date_of_birth": date(1985, 3, 20),
        "age": 41,
        "credit_score": 680,
        "status": "active",
        "is_active": True,
        "bio": None,
        "joined_date": date(2026, 1, 2),
    },
    {
        "id": 3,
        "first_name": "Charlie",
        "last_name": "Chen",
        "full_name": "Charlie Chen",
        "email": "charlie@test.com",
        "address": "300 Pine Rd",
        "city": "Seattle",
        "country": "USA",
        "zipcode": "33333",
        "date_of_birth": date(1992, 6, 10),
        "age": 34,
        "credit_score": 650,
        "status": "inactive",
        "is_active": False,
        "bio": "Churned in Q2 2026.",
        "joined_date": date(2026, 1, 3),
    },
    {
        "id": 4,
        "first_name": "Diana",
        "last_name": "Davis",
        "full_name": "Diana Davis",
        "email": "diana@test.com",
        "address": "400 Elm St",
        "city": "Austin",
        "country": "USA",
        "zipcode": "44444",
        "date_of_birth": date(1988, 11, 2),
        "age": 38,
        "credit_score": 750,
        "status": "active",
        "is_active": True,
        "bio": "High-value account.",
        "joined_date": date(2026, 1, 4),
    },
    {
        "id": 5,
        "first_name": "Eve",
        "last_name": "Evans",
        "full_name": "Eve Evans",
        "email": "eve@test.com",
        "address": "500 Birch Ln",
        "city": "Denver",
        "country": "USA",
        "zipcode": "55555",
        "date_of_birth": date(2000, 5, 25),
        "age": 26,
        "credit_score": 600,
        "status": "pending",
        "is_active": True,
        "bio": None,
        "joined_date": date(2026, 1, 5),
    },
]


COMMON_TRANSACTION_ROWS: list[dict[str, Any]] = [
    {
        "id": 1,
        "customer_id": 1,
        "amount": Decimal("125.50"),
        "currency": "USD",
        "exchange_rate": Decimal("1.0000"),
        "status": "completed",
        "txn_at": datetime(2026, 2, 1, 9, 15, 0),
        "reference_number": "TXN000000001",
        "ip_address": "10.0.0.1",
        "notes": "Monthly subscription renewal.",
    },
    {
        "id": 2,
        "customer_id": 1,
        "amount": Decimal("49.99"),
        "currency": "USD",
        "exchange_rate": Decimal("1.0000"),
        "status": "completed",
        "txn_at": datetime(2026, 2, 5, 14, 30, 0),
        "reference_number": "TXN000000002",
        "ip_address": "10.0.0.1",
        "notes": None,
    },
    {
        "id": 3,
        "customer_id": 2,
        "amount": Decimal("250.00"),
        "currency": "USD",
        "exchange_rate": Decimal("1.0000"),
        "status": "completed",
        "txn_at": datetime(2026, 2, 10, 11, 20, 0),
        "reference_number": "TXN000000003",
        "ip_address": "10.0.0.2",
        "notes": "Premium upgrade.",
    },
    {
        "id": 4,
        "customer_id": 3,
        "amount": Decimal("19.99"),
        "currency": "USD",
        "exchange_rate": Decimal("1.0000"),
        "status": "refunded",
        "txn_at": datetime(2026, 2, 12, 16, 45, 0),
        "reference_number": "TXN000000004",
        "ip_address": "10.0.0.3",
        "notes": "Customer requested refund.",
    },
    {
        "id": 5,
        "customer_id": 4,
        "amount": Decimal("125.50"),
        "currency": "EUR",
        "exchange_rate": Decimal("1.0850"),
        "status": "completed",
        "txn_at": datetime(2026, 2, 18, 13, 10, 0),
        "reference_number": "TXN000000005",
        "ip_address": "10.0.0.4",
        "notes": None,
    },
]
