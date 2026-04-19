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

"""
Integration tests for SingleStore median/percentile functions.

- TestSingleStoreMedianFnSQL: SQL compilation tests — run everywhere, no container needed.
- TestSingleStoreMedianFnExecution: executes against a real SingleStore container.
  Skipped on non-x86_64 (SingleStore only publishes amd64 images).
"""

import platform
import time

import pymysql
import pytest
from sqlalchemy import column, create_engine, text
from sqlalchemy.dialects import mysql as mysql_dialect
from sqlalchemy.orm import Session

from metadata.profiler.source.database.single_store.functions.median import (
    SingleStoreMedianFn,
)

try:
    from testcontainers.core.container import DockerContainer

    HAS_TESTCONTAINERS = True
except ImportError:
    HAS_TESTCONTAINERS = False

requires_x86 = pytest.mark.skipif(
    platform.machine() != "x86_64",
    reason="SingleStore image requires x86_64",
)
requires_testcontainers = pytest.mark.skipif(
    not HAS_TESTCONTAINERS,
    reason="testcontainers not installed",
)

# Test data: 10 rows, 2 categories
# category "a": values [10, 20, 30, 40, 50] -> median=30, Q1=20, Q3=40
# category "b": values [100, 200, 300, 400, 500] -> median=300, Q1=200, Q3=400
TEST_ROWS = [
    (1, 10.0, "a"),
    (2, 20.0, "a"),
    (3, 30.0, "a"),
    (4, 40.0, "a"),
    (5, 50.0, "a"),
    (6, 100.0, "b"),
    (7, 200.0, "b"),
    (8, 300.0, "b"),
    (9, 400.0, "b"),
    (10, 500.0, "b"),
]

SINGLESTORE_ROOT_PASSWORD = "root_password"
SINGLESTORE_PORT = 3306


def _build_fn(col_name, table_name, percentile, dimension_col=None):
    args = (column(col_name), table_name, percentile)
    if dimension_col is not None:
        args = args + (dimension_col,)
    return SingleStoreMedianFn(*args)


def _compile(col_name, table_name, percentile, dimension_col=None):
    """Compile using the stock MySQL dialect (no container needed)."""
    fn = _build_fn(col_name, table_name, percentile, dimension_col)
    return str(
        fn.compile(
            dialect=mysql_dialect.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


class TestSingleStoreMedianFnSQL:
    def test_non_correlated_sql(self):
        compiled = _compile("value", "test_data", 0.50)
        assert compiled == "approx_percentile(value, 0.50)"

    def test_non_correlated_q1_sql(self):
        compiled = _compile("value", "test_data", 0.25)
        assert compiled == "approx_percentile(value, 0.25)"

    def test_non_correlated_q3_sql(self):
        compiled = _compile("value", "test_data", 0.75)
        assert compiled == "approx_percentile(value, 0.75)"

    def test_correlated_sql(self):
        compiled = _compile("value", "test_data", 0.50, "category")
        assert "approx_percentile(value, 0.50)" in compiled
        assert "FROM test_data AS median_inner" in compiled
        assert "WHERE median_inner.category = test_data.category" in compiled

    def test_correlated_is_subquery(self):
        compiled = _compile("value", "test_data", 0.50, "category")
        assert compiled.startswith("(SELECT ")
        assert compiled.endswith(")")

    def test_no_subquery_without_dimension(self):
        compiled = _compile("value", "test_data", 0.50)
        assert "median_inner" not in compiled
        assert "WHERE" not in compiled
        assert "SELECT" not in compiled


def _wait_for_singlestore(host, port, timeout=180):
    """Poll until SingleStore accepts connections on the MySQL port."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            conn = pymysql.connect(
                host=host,
                port=port,
                user="root",
                password=SINGLESTORE_ROOT_PASSWORD,
                connect_timeout=5,
            )
            conn.close()
            return
        except pymysql.err.OperationalError:
            time.sleep(2)
    raise TimeoutError(f"SingleStore not ready on {host}:{port} after {timeout}s")


@pytest.fixture(scope="module")
def singlestore_engine():
    container = (
        DockerContainer(image="ghcr.io/singlestore-labs/singlestoredb-dev:latest")
        .with_exposed_ports(SINGLESTORE_PORT)
        .with_env("ROOT_PASSWORD", SINGLESTORE_ROOT_PASSWORD)
    )
    with container:
        host = container.get_container_host_ip()
        port = int(container.get_exposed_port(SINGLESTORE_PORT))
        _wait_for_singlestore(host, port, timeout=180)
        url = (
            f"mysql+pymysql://root:{SINGLESTORE_ROOT_PASSWORD}"
            f"@{host}:{port}/information_schema"
        )
        engine = create_engine(url)
        with engine.connect() as conn:
            conn.execute(text("CREATE DATABASE IF NOT EXISTS test_db"))
            conn.execute(text("USE test_db"))
            conn.execute(
                text(
                    "CREATE TABLE test_data ("
                    "id INTEGER PRIMARY KEY, "
                    "value DOUBLE NOT NULL, "
                    "category VARCHAR(50) NOT NULL)"
                )
            )
            values = ", ".join(f"({row[0]}, {row[1]}, '{row[2]}')" for row in TEST_ROWS)
            conn.execute(
                text(f"INSERT INTO test_data (id, value, category) VALUES {values}")
            )
            conn.commit()
        engine.dispose()
        engine = create_engine(url.replace("information_schema", "test_db"))
        yield engine
        engine.dispose()


@pytest.fixture(scope="module")
def session(singlestore_engine):
    with Session(singlestore_engine) as session:
        yield session


def _compile_with_session(
    session, col_name, table_name, percentile, dimension_col=None
):
    fn = _build_fn(col_name, table_name, percentile, dimension_col)
    return fn.compile(
        dialect=session.get_bind().dialect,
        compile_kwargs={"literal_binds": True},
    )


@requires_x86
@requires_testcontainers
class TestSingleStoreMedianFnExecution:
    """no ARM image only run on x86_64 machines"""

    def test_median_non_correlated(self, session):
        compiled = _compile_with_session(session, "value", "test_data", 0.50)
        result = session.execute(
            text(f"SELECT {compiled} AS median_val FROM test_data LIMIT 1")
        ).scalar()
        assert result is not None
        assert result == 75.0

    def test_first_quartile_non_correlated(self, session):
        compiled = _compile_with_session(session, "value", "test_data", 0.25)
        result = session.execute(
            text(f"SELECT {compiled} AS q1_val FROM test_data LIMIT 1")
        ).scalar()
        assert result is not None
        assert result == 30.0

    def test_third_quartile_non_correlated(self, session):
        compiled = _compile_with_session(session, "value", "test_data", 0.75)
        result = session.execute(
            text(f"SELECT {compiled} AS q3_val FROM test_data LIMIT 1")
        ).scalar()
        assert result is not None
        assert result == 300.0

    def test_median_with_dimension_col(self, session):
        compiled = _compile_with_session(
            session, "value", "test_data", 0.50, "category"
        )
        # SingleStore Distributed rejects scalar subselects combined with
        # DISTINCT or ORDER BY. Query raw rows and deduplicate in Python.
        results = session.execute(
            text(f"SELECT category, {compiled} AS median_val FROM test_data")
        ).fetchall()
        medians = {row[0]: row[1] for row in results}
        assert medians["a"] == 30.0
        assert medians["b"] == 300.0

    def test_first_quartile_with_dimension_col(self, session):
        compiled = _compile_with_session(
            session, "value", "test_data", 0.25, "category"
        )
        results = session.execute(
            text(f"SELECT category, {compiled} AS q1_val FROM test_data")
        ).fetchall()
        medians = {row[0]: row[1] for row in results}
        assert medians["a"] == 17.5
        assert medians["b"] == 175.0

    def test_third_quartile_with_dimension_col(self, session):
        compiled = _compile_with_session(
            session, "value", "test_data", 0.75, "category"
        )
        results = session.execute(
            text(f"SELECT category, {compiled} AS q3_val FROM test_data")
        ).fetchall()
        medians = {row[0]: row[1] for row in results}
        assert medians["a"] == 42.5
        assert medians["b"] == 425.0
