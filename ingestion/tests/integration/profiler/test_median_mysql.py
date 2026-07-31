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

"""
Integration tests for MySQL median/percentile functions against a real MySQL container.

Validates that MedianFn (MySQL dialect compile) returns deterministic, correct
percentile-discrete values for both non-correlated (whole-table) and correlated
(dimension_col) modes. Regression sentinel for the pre-2026-04-29 bug where
ROW_NUMBER() OVER () lacked a window ORDER BY and the @counter user-variable
side-effect ordering was undefined — both producing non-deterministic results.

Note on expected values: MySQL's MedianFn uses percentile-discrete via
ROUND(percentile * COUNT(*)), picking a single existing row at the sorted
position. MariaDB's PERCENTILE_CONT interpolates. Same seed data → different
expected values across the two dialects.
"""

import pytest
from sqlalchemy import Column, Float, Integer, String, column, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session

from metadata.profiler.orm.functions.median import MedianFn

try:
    from testcontainers.core.wait_strategies import LogMessageWaitStrategy
    from testcontainers.mysql import MySqlContainer
except ImportError:
    pytest.skip("testcontainers not installed", allow_module_level=True)


class Base(DeclarativeBase):
    pass


class MedianTestData(Base):
    __tablename__ = "test_data"
    id = Column(Integer, primary_key=True)
    value = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)


# Test data: 10 rows, 2 categories of 5.
# Whole table sorted: [10, 20, 30, 40, 50, 100, 200, 300, 400, 500]
#   p=0.50 → ROUND(5.00)=5 → 5th =  50
#   p=0.25 → ROUND(2.50)=3 → 3rd =  30
#   p=0.75 → ROUND(7.50)=8 → 8th = 300
# Per-dimension (5 rows each):
#   cat "a" [10, 20, 30, 40, 50]:    p=0.50 → 3rd =  30, p=0.25 → 1st =  10, p=0.75 → 4th =  40
#   cat "b" [100,200,300,400,500]:   p=0.50 → 3rd = 300, p=0.25 → 1st = 100, p=0.75 → 4th = 400
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


def _compile_median_fn(session, col_name, table_name, percentile, dimension_col=None):
    """Compile a MedianFn to SQL string using the session's MySQL dialect."""
    args = (column(col_name), table_name, percentile)
    if dimension_col is not None:
        args = args + (dimension_col,)
    fn = MedianFn(*args)
    return fn.compile(
        dialect=session.get_bind().dialect,
        compile_kwargs={"literal_binds": True},
    )


@pytest.fixture(scope="module")
def mysql_engine():
    # MySQL 8 cold-start commonly exceeds the 10s default; wait up to 120s
    # for the single "ready for connections" log line from the main server
    # (the testcontainers default regex expects two occurrences which only
    # MariaDB emits — MySQL emits one).
    container = MySqlContainer(image="mysql:8.0", dbname="test_db").waiting_for(
        LogMessageWaitStrategy("ready for connections").with_startup_timeout(120)
    )
    with container as container:
        url = container.get_connection_url()
        if url.startswith("mysql://"):
            url = "mysql+pymysql://" + url[len("mysql://") :]
        engine = create_engine(url)
        with engine.connect() as conn:
            conn.execute(
                text(
                    "CREATE TABLE test_data ("
                    "id INTEGER PRIMARY KEY, "
                    "value DOUBLE NOT NULL, "
                    "category VARCHAR(50) NOT NULL)"
                )
            )
            values = ", ".join(f"({row[0]}, {row[1]}, '{row[2]}')" for row in TEST_ROWS)
            conn.execute(text(f"INSERT INTO test_data (id, value, category) VALUES {values}"))
            conn.commit()
        yield engine
        engine.dispose()


@pytest.fixture(scope="module")
def session(mysql_engine):
    with Session(mysql_engine) as session:
        yield session


class TestMySQLMedianFn:
    def test_median_non_correlated(self, session):
        """p=0.5 over 10-row table picks the 5th sorted element (50)."""
        compiled = _compile_median_fn(session, "value", "test_data", 0.50)
        result = session.execute(text(f"SELECT {compiled} AS median_val FROM test_data LIMIT 1")).scalar()
        assert result == pytest.approx(50.0)

    def test_first_quartile_non_correlated(self, session):
        """p=0.25 over 10-row table picks the 3rd sorted element (30)."""
        compiled = _compile_median_fn(session, "value", "test_data", 0.25)
        result = session.execute(text(f"SELECT {compiled} AS q1_val FROM test_data LIMIT 1")).scalar()
        assert result == pytest.approx(30.0)

    def test_third_quartile_non_correlated(self, session):
        """p=0.75 over 10-row table picks the 8th sorted element (300)."""
        compiled = _compile_median_fn(session, "value", "test_data", 0.75)
        result = session.execute(text(f"SELECT {compiled} AS q3_val FROM test_data LIMIT 1")).scalar()
        assert result == pytest.approx(300.0)

    def test_median_with_dimension_col(self, session):
        """Per-group median: 3rd element of each 5-row group."""
        compiled = _compile_median_fn(session, "value", "test_data", 0.50, "category")
        results = session.execute(
            text(f"SELECT DISTINCT category, {compiled} AS median_val FROM test_data ORDER BY category")
        ).fetchall()
        medians = {row[0]: row[1] for row in results}
        assert medians["a"] == pytest.approx(30.0)
        assert medians["b"] == pytest.approx(300.0)

    def test_first_quartile_with_dimension_col(self, session):
        """Per-group Q1: 1st element of each 5-row group."""
        compiled = _compile_median_fn(session, "value", "test_data", 0.25, "category")
        results = session.execute(
            text(f"SELECT DISTINCT category, {compiled} AS q1_val FROM test_data ORDER BY category")
        ).fetchall()
        q1s = {row[0]: row[1] for row in results}
        assert q1s["a"] == pytest.approx(10.0)
        assert q1s["b"] == pytest.approx(100.0)

    def test_third_quartile_with_dimension_col(self, session):
        """Per-group Q3: 4th element of each 5-row group."""
        compiled = _compile_median_fn(session, "value", "test_data", 0.75, "category")
        results = session.execute(
            text(f"SELECT DISTINCT category, {compiled} AS q3_val FROM test_data ORDER BY category")
        ).fetchall()
        q3s = {row[0]: row[1] for row in results}
        assert q3s["a"] == pytest.approx(40.0)
        assert q3s["b"] == pytest.approx(400.0)

    def test_compiled_sql_uses_window_order_by(self, session):
        """Regression sentinel: ROW_NUMBER() OVER must include ORDER BY {col}.

        Without the ORDER BY in the window spec, row numbers are assigned in
        implementation-defined storage order, making the percentile pick
        non-deterministic. This was the original bug from #10962.
        """
        compiled = str(_compile_median_fn(session, "value", "test_data", 0.50))
        assert "ROW_NUMBER() OVER (ORDER BY" in compiled
        assert "ROW_NUMBER() OVER ()" not in compiled

    def test_compiled_sql_avoids_user_variable_counter(self, session):
        """Regression sentinel: must not use @counter user-variable.

        MySQL leaves the evaluation order of expressions involving user
        variables undefined. The original impl used `(SELECT @counter := COUNT(*)
        FROM tbl) t_count` cross-joined with the data table, then read @counter
        in the outer WHERE — making the result depend on optimizer choices.
        """
        compiled = str(_compile_median_fn(session, "value", "test_data", 0.50))
        assert "@counter" not in compiled
        assert "COUNT(*) OVER ()" in compiled

    def test_median_non_correlated_deterministic_across_runs(self, session):
        """Same query 10x must return the same value — pre-fix this flipped."""
        compiled = _compile_median_fn(session, "value", "test_data", 0.50)
        results = {
            session.execute(text(f"SELECT {compiled} AS median_val FROM test_data LIMIT 1")).scalar() for _ in range(10)
        }
        assert len(results) == 1, f"non-deterministic: got {results}"
