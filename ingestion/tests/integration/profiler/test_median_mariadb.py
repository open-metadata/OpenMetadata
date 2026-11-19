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
Integration tests for MariaDB median/percentile functions against a real MariaDB container.

Validates that MariaDBMedianFn produces correct SQL and returns accurate results
for both non-correlated (whole-table) and correlated (dimension_col) modes.
"""

import pytest
from sqlalchemy import Column, Float, Integer, String, column, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session

from metadata.profiler.source.database.mariadb.functions.median import MariaDBMedianFn

try:
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


def _compile_median_fn(session, col_name, table_name, percentile, dimension_col=None):
    """Compile a MariaDBMedianFn to SQL string using the session's dialect."""
    args = (column(col_name), table_name, percentile)
    if dimension_col is not None:
        args = args + (dimension_col,)
    fn = MariaDBMedianFn(*args)
    return fn.compile(
        dialect=session.get_bind().dialect,
        compile_kwargs={"literal_binds": True},
    )


@pytest.fixture(scope="module")
def mariadb_engine():
    container = MySqlContainer(image="mariadb:11", dbname="test_db")
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
def session(mariadb_engine):
    with Session(mariadb_engine) as session:
        yield session


class TestMariaDBMedianFn:
    def test_median_non_correlated(self, session):
        """PERCENTILE_CONT(0.50) OVER() returns correct median for entire table"""
        compiled = _compile_median_fn(session, "value", "test_data", 0.50)
        result = session.execute(text(f"SELECT {compiled} AS median_val FROM test_data LIMIT 1")).scalar()
        assert result is not None
        assert result == pytest.approx(75.0, abs=1.0)

    def test_first_quartile_non_correlated(self, session):
        """PERCENTILE_CONT(0.25) OVER() returns correct Q1 for entire table"""
        compiled = _compile_median_fn(session, "value", "test_data", 0.25)
        result = session.execute(text(f"SELECT {compiled} AS q1_val FROM test_data LIMIT 1")).scalar()
        assert result is not None
        assert result == pytest.approx(32.5, abs=1.0)

    def test_third_quartile_non_correlated(self, session):
        """PERCENTILE_CONT(0.75) OVER() returns correct Q3 for entire table"""
        compiled = _compile_median_fn(session, "value", "test_data", 0.75)
        result = session.execute(text(f"SELECT {compiled} AS q3_val FROM test_data LIMIT 1")).scalar()
        assert result is not None
        assert result == pytest.approx(275.0, abs=1.0)

    def test_median_with_dimension_col(self, session):
        """MariaDBMedianFn with dimension_col generates PARTITION BY and returns per-group median"""
        compiled = _compile_median_fn(session, "value", "test_data", 0.50, "category")
        results = session.execute(
            text(f"SELECT DISTINCT category, {compiled} AS median_val FROM test_data ORDER BY category")
        ).fetchall()
        medians = {row[0]: row[1] for row in results}
        assert medians["a"] == pytest.approx(30.0, abs=1.0)
        assert medians["b"] == pytest.approx(300.0, abs=1.0)

    def test_first_quartile_with_dimension_col(self, session):
        """MariaDBMedianFn Q1 with dimension_col returns per-group first quartile"""
        compiled = _compile_median_fn(session, "value", "test_data", 0.25, "category")
        results = session.execute(
            text(f"SELECT DISTINCT category, {compiled} AS q1_val FROM test_data ORDER BY category")
        ).fetchall()
        medians = {row[0]: row[1] for row in results}
        assert medians["a"] == pytest.approx(20.0, abs=1.0)
        assert medians["b"] == pytest.approx(200.0, abs=1.0)

    def test_third_quartile_with_dimension_col(self, session):
        """MariaDBMedianFn Q3 with dimension_col returns per-group third quartile"""
        compiled = _compile_median_fn(session, "value", "test_data", 0.75, "category")
        results = session.execute(
            text(f"SELECT DISTINCT category, {compiled} AS q3_val FROM test_data ORDER BY category")
        ).fetchall()
        medians = {row[0]: row[1] for row in results}
        assert medians["a"] == pytest.approx(40.0, abs=1.0)
        assert medians["b"] == pytest.approx(400.0, abs=1.0)

    def test_compiled_sql_contains_partition_by(self, session):
        """Verify the compiled SQL includes PARTITION BY when dimension_col is set"""
        compiled = str(_compile_median_fn(session, "value", "test_data", 0.50, "category"))
        assert "PARTITION BY category" in compiled

    def test_compiled_sql_no_partition_without_dimension(self, session):
        """Verify the compiled SQL uses plain OVER() without dimension_col"""
        compiled = str(_compile_median_fn(session, "value", "test_data", 0.50))
        assert "OVER()" in compiled
        assert "PARTITION BY" not in compiled
