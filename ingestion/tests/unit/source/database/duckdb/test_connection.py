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
"""DuckDB connection, URL and reflection against real database files."""

import subprocess
import sys

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError

from ingestion.tests.unit.source.database.duckdb._fixtures import connection_config, engine_for
from metadata.generated.schema.entity.services.connections.database.duckDBConnection import (
    DuckDBConnection as DuckDBConnectionConfig,
)
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.source.database.duckdb.connection import (
    get_connection_url,
    get_database_name,
)


def test_files_open_read_only_with_connection_options():
    config = DuckDBConnectionConfig(databaseFilePath="/data/my warehouse.duckdb", connectionOptions={"threads": "2"})

    url = make_url(get_connection_url(config))

    assert url.drivername == "duckdb"
    assert url.database == "/data/my warehouse.duckdb"
    assert dict(url.query) == {"access_mode": "read_only", "threads": "2"}


def test_connection_options_cannot_make_the_file_writable():
    config = DuckDBConnectionConfig(
        databaseFilePath="/data/warehouse.duckdb", connectionOptions={"access_mode": "read_write"}
    )

    assert make_url(get_connection_url(config)).query["access_mode"] == "read_only"


def test_in_memory_database_is_not_opened_read_only():
    config = DuckDBConnectionConfig(databaseFilePath=":memory:")

    assert get_connection_url(config) == "duckdb:///:memory:"


def test_connection_options_reach_duckdb(shop_db):
    with engine_for(shop_db).connect() as conn:
        assert conn.execute(text("SELECT current_setting('threads')")).scalar() == 1
        assert conn.execute(text("SELECT current_setting('access_mode')")).scalar() == "read_only"


def test_ingestion_cannot_write_to_the_file(shop_db):
    with engine_for(shop_db).connect() as conn, pytest.raises(DBAPIError, match="read-only"):
        conn.execute(text("CREATE TABLE should_fail (x INTEGER)"))


def test_other_processes_can_read_the_file_during_ingestion(shop_db):
    """Concurrent workflows (metadata, profiler, lineage) each open the file from their own process."""
    reader = "import duckdb, sys; print(duckdb.connect(sys.argv[1], read_only=True).execute('SELECT 42').fetchone()[0])"
    with engine_for(shop_db).connect() as conn:
        conn.execute(text("SELECT 1"))
        result = subprocess.run(
            [sys.executable, "-c", reader, str(shop_db)], capture_output=True, text=True, check=False, timeout=60
        )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "42"


def test_database_is_named_after_the_catalog_unless_configured(shop_db):
    engine = engine_for(shop_db)

    assert get_database_name(engine, connection_config(shop_db)) == "shop"
    assert get_database_name(engine, connection_config(shop_db, databaseName="sales")) == "sales"


def test_reflection_ignores_attached_catalogs(shop_db, other_db):
    inspector = inspect(engine_for(shop_db, attach=other_db))

    assert inspector.get_schema_names() == ["analytics", "main"]
    assert inspector.get_table_names("main") == ["customers", "orders"]
    assert inspector.get_view_names("main") == ["customer_totals"]
    assert [column["name"] for column in inspector.get_columns("customers", "main")][:3] == [
        "id",
        "email",
        "balance",
    ]
    assert inspector.get_table_comment("customers", "main") == {"text": "People who bought something"}
    assert inspector.get_pk_constraint("customers", "main")["constrained_columns"] == ["id"]


def test_reflection_accepts_catalog_qualified_schema_names(shop_db):
    inspector = inspect(engine_for(shop_db))

    assert inspector.get_table_names("shop.analytics") == ["daily_revenue"]


def test_columns_carry_nullability_defaults_and_comments(shop_db):
    columns = {column["name"]: column for column in inspect(engine_for(shop_db)).get_columns("customers", "main")}

    assert columns["id"]["nullable"] is False
    assert columns["email"]["nullable"] is True
    assert columns["email"]["comment"] == "Primary contact address"


def test_view_definition_is_the_create_statement(shop_db):
    definition = inspect(engine_for(shop_db)).get_view_definition("customer_totals", "main")

    assert definition.startswith("CREATE VIEW customer_totals AS")
    assert "LEFT JOIN orders" in definition


def test_table_comment(shop_db):
    assert inspect(engine_for(shop_db)).get_table_comment("customers", "main") == {
        "text": "People who bought something"
    }


def test_primary_unique_and_foreign_keys(shop_db):
    inspector = inspect(engine_for(shop_db))

    assert inspector.get_pk_constraint("customers", "main")["constrained_columns"] == ["id"]
    assert [c["column_names"] for c in inspector.get_unique_constraints("customers", "main")] == [["email"]]
    assert inspector.get_foreign_keys("orders", "main") == [
        {
            "name": None,
            "constrained_columns": ["customer_id"],
            "referred_schema": "main",
            "referred_table": "customers",
            "referred_columns": ["id"],
            "options": {},
        }
    ]


def test_constraint_reflection_leaves_the_connection_usable(shop_db):
    with engine_for(shop_db).connect() as conn:
        inspector = inspect(conn)
        for table in ("customers", "orders"):
            inspector.get_pk_constraint(table, "main")
            inspector.get_unique_constraints(table, "main")
            inspector.get_foreign_keys(table, "main")
        assert conn.execute(text("SELECT count(*) FROM orders")).scalar() == 0


def test_lineage_parses_queries_with_the_duckdb_dialect():
    assert ConnectionTypeDialectMapper.dialect_of("DuckDB") == Dialect.DUCKDB
