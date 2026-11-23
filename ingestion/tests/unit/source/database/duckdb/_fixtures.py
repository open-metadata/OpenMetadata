#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Shared DuckDB test data and helpers: real database files, built per test."""

from pathlib import Path

import duckdb
from sqlalchemy import event
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.duckDBConnection import (
    DuckDBConnection as DuckDBConnectionConfig,
)
from metadata.ingestion.source.database.duckdb.connection import DuckDBConnection

DUCKDB_TEST_CONFIG = {"threads": "1", "memory_limit": "256MB"}

SHOP_DDL = [
    "CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy')",
    """
    CREATE TABLE customers (
        id BIGINT PRIMARY KEY,
        email VARCHAR UNIQUE,
        balance DECIMAL(12, 2),
        visits UBIGINT,
        lifetime_value HUGEINT,
        signed_up TIMESTAMP_NS,
        updated_at TIMESTAMP WITH TIME ZONE,
        tags VARCHAR[],
        last_three_scores INTEGER[3],
        address STRUCT(street VARCHAR, "zip code" VARCHAR, geo STRUCT(lat DOUBLE, lon DOUBLE)),
        attributes MAP(VARCHAR, INTEGER[]),
        orders_summary STRUCT(order_id BIGINT, total DECIMAL(10, 2))[],
        current_mood mood,
        contact UNION(phone VARCHAR, ext INTEGER)
    )
    """,
    "COMMENT ON TABLE customers IS 'People who bought something'",
    "COMMENT ON COLUMN customers.email IS 'Primary contact address'",
    """
    CREATE TABLE orders (
        id BIGINT PRIMARY KEY,
        customer_id BIGINT REFERENCES customers (id),
        total DECIMAL(12, 2) NOT NULL
    )
    """,
    """
    CREATE VIEW customer_totals AS
    SELECT c.id AS customer_id, SUM(o.total) AS total_spent
    FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id
    """,
    "CREATE SCHEMA analytics",
    "CREATE TABLE analytics.daily_revenue (day DATE, revenue DECIMAL(18, 2))",
]

OTHER_DDL = [
    "CREATE TABLE customers (shadow INTEGER)",
    "COMMENT ON TABLE customers IS 'Belongs to another catalog'",
    "CREATE TABLE only_in_other (x INTEGER)",
]

QUERY_LOG_DDL = """
CREATE TABLE main.duckdb_query_log (
    query_text VARCHAR,
    user_name VARCHAR,
    schema_name VARCHAR,
    start_time TIMESTAMP,
    duration_ms DOUBLE,
    aborted BOOLEAN
)
"""

LOGGED_QUERIES = [
    (60, "SELECT * FROM customers WHERE balance > 100", "analyst", 5.0),
    (30, "INSERT INTO orders SELECT id, id, balance FROM customers", "analyst", 5.0),
    (5, "CREATE TABLE analytics.big_spenders AS SELECT * FROM customer_totals WHERE total_spent > 1000", None, None),
]


def create_database(path: Path, statements: list[str]) -> Path:
    with duckdb.connect(str(path), config=DUCKDB_TEST_CONFIG) as conn:
        for statement in statements:
            conn.execute(statement)
    return path


def connection_config(path: Path, **overrides) -> DuckDBConnectionConfig:
    return DuckDBConnectionConfig.model_validate(
        {"databaseFilePath": str(path), "connectionOptions": DUCKDB_TEST_CONFIG, **overrides}
    )


def engine_for(path: Path, attach: Path | None = None) -> Engine:
    engine = DuckDBConnection(connection_config(path)).client
    if attach is not None:

        @event.listens_for(engine, "connect")
        def _attach(dbapi_connection, _):
            dbapi_connection.execute(f"ATTACH '{attach}' AS other (READ_ONLY)")

    return engine
