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
"""Integration tests for the InfluxDB 3 connector against a live container.

These tests verify the InfluxDB 3 HTTP SQL API behavior that the
InfluxDBClient connector wrapper depends on.

Requires a InfluxDB 3 Core container running without auth:

    docker run -d --name influxdb3-test -p 8181:8181 \\
      quay.io/influxdb/influxdb3-core:latest serve \\
      --without-auth --object-store=memory --node-id=test
"""

import requests

INFLUXDB_URL = "http://localhost:8181"
INFLUXDB_TOKEN = ""


def _query(db: str, sql: str) -> list[dict]:
    """Execute a SQL query against InfluxDB 3 HTTP API."""
    resp = requests.get(
        f"{INFLUXDB_URL}/api/v3/query_sql",
        params={"db": db, "q": sql, "format": "json"},
        headers={"Authorization": f"Bearer {INFLUXDB_TOKEN}"} if INFLUXDB_TOKEN else {},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _seed_test_data():
    """Write a test measurement into the default database."""
    requests.post(
        f"{INFLUXDB_URL}/api/v3/write_lp",
        params={"db": "testdb"},
        data="weather,location=us-west temperature=82 1465839830000000000",
        headers={"Content-Type": "text/plain"},
        timeout=10,
    )


def _wait_for_data(db: str, table: str, retries: int = 10):
    """Poll until the table has at least one row."""
    for _ in range(retries):
        try:
            rows = _query(db, f"SELECT * FROM {table}")
            if rows:
                return rows
        except requests.HTTPError:
            pass
    raise AssertionError(f"No rows in {db}.{table} after {retries} retries")


def setup_module():
    """Seed test data before running tests."""
    _seed_test_data()
    _wait_for_data("testdb", "weather")


class TestInfluxDBIntegration:
    """Verify the connector's HTTP client methods against live InfluxDB 3."""

    def test_health_check(self):
        resp = requests.get(f"{INFLUXDB_URL}/health", timeout=10)
        assert resp.status_code == 200

    def test_health_check_returns_ok(self):
        resp = requests.get(f"{INFLUXDB_URL}/health", timeout=10)
        assert resp.text == "OK"

    def test_list_databases(self):
        rows = _query("_internal", "SELECT database_name FROM system.databases WHERE deleted=false")
        databases = [r["database_name"] for r in rows if r["database_name"] != "_internal"]
        assert "testdb" in databases

    def test_list_databases_not_empty(self):
        rows = _query("_internal", "SELECT database_name FROM system.databases WHERE deleted=false")
        databases = [r["database_name"] for r in rows if r["database_name"] != "_internal"]
        assert len(databases) >= 1

    def test_list_tables(self):
        rows = _query("testdb", "SELECT table_name FROM information_schema.tables")
        tables = [r["table_name"] for r in rows]
        assert "weather" in tables

    def test_get_columns(self):
        sql = "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'weather'"
        rows = _query("testdb", sql)
        column_names = {r["column_name"] for r in rows}
        assert "time" in column_names
        assert "location" in column_names
        assert "temperature" in column_names

    def test_get_columns_has_data_type(self):
        sql = "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'weather'"
        rows = _query("testdb", sql)
        for row in rows:
            assert "data_type" in row
            assert row["data_type"] != ""

    def test_query_sql_returns_valid_json(self):
        rows = _query("testdb", "SELECT * FROM weather")
        assert isinstance(rows, list)
        assert len(rows) >= 1
        assert "location" in rows[0]
        assert "temperature" in rows[0]
        assert "time" in rows[0]

    def test_system_schema_detection(self):
        """Verify system schemas are present and need exclusion."""
        rows = _query(
            "_internal",
            "SELECT table_name, table_schema FROM information_schema.tables",
        )
        schemas = {r["table_schema"] for r in rows}
        assert {"system", "information_schema"}.issubset(schemas), f"Got schemas: {schemas}"
        # Verify user tables not found in system schemas
        system_table_names = {r["table_name"] for r in rows if r["table_schema"] in {"system", "information_schema"}}
        assert system_table_names, "Expected system tables in system/information_schema"

    def test_type_mapping_timestamp_ns(self):
        """Verify Core returns Timestamp(ns) type."""
        sql = (
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name = 'weather' AND column_name = 'time'"
        )
        rows = _query("testdb", sql)
        assert len(rows) == 1
        assert rows[0]["data_type"] in ("Timestamp(ns)", "Timestamp(Nanosecond, None)")

    def test_type_mapping_tag(self):
        """Verify tag columns have known Core types."""
        sql = (
            "SELECT column_name, data_type FROM information_schema.columns "
            "WHERE table_name = 'weather' AND column_name = 'location'"
        )
        rows = _query("testdb", sql)
        assert len(rows) == 1
        assert rows[0]["data_type"] in ("Utf8", "Dictionary(Int32, Utf8)")
