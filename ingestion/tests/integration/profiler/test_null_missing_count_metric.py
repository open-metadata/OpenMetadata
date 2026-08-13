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
Integration tests for the NullMissingCount metric against real engines.

The metric backs the `columnValuesMissingCount` data quality test. Comparing a
non-string column against '' fails on PostgreSQL and returns the wrong count on
MySQL, so both engines are exercised here.

Container types need a real engine to be tested at all: a JSON comparison only
fails once PostgreSQL looks for a `json = text` operator, and an array comparison
never fails — SQLAlchemy binds '' as an empty array, so the wrong count comes back
silently. Neither shows up when the metric is merely compiled.
"""

import datetime

import pytest
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    Integer,
    String,
    create_engine,
    select,
)
from sqlalchemy.orm import DeclarativeBase
from testcontainers.mysql import MySqlContainer
from testcontainers.postgres import PostgresContainer

from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.types.custom_array import CustomArray


class Base(DeclarativeBase):
    pass


class MissingCountTestTable(Base):
    __tablename__ = "missing_count_test"
    row_id = Column(Integer, primary_key=True)
    int_col = Column(Integer)
    date_col = Column(Date)
    bool_col = Column(Boolean)
    str_col = Column(String(64))
    # none_as_null so a Python None lands as SQL NULL rather than the JSON literal
    # null, which IS NULL would not match
    json_col = Column(JSON(none_as_null=True))


class ArrayBase(DeclarativeBase):
    """Separate metadata: arrays are PostgreSQL-only, MySQL has no array type"""


class ArrayMissingCountTestTable(ArrayBase):
    __tablename__ = "array_missing_count_test"
    row_id = Column(Integer, primary_key=True)
    # CustomArray, not ARRAY: this is what the ORM converter builds for DataType.ARRAY
    str_array_col = Column(CustomArray(String(64)))
    int_array_col = Column(CustomArray(Integer))


# 3 NULLs per column, plus the values MySQL would coerce '' into: 2 zeros in
# int_col and 2 false in bool_col. Only the NULLs are missing for those columns;
# str_col also counts its 2 empty strings. json_col holds an empty object and an
# empty array, which are present values rather than missing ones.
ROWS = [
    (1, 0, datetime.date(2024, 1, 1), False, "", {"key": "value"}),
    (2, 0, datetime.date(2024, 1, 2), False, "", {}),
    (3, 7, datetime.date(2024, 1, 3), True, "a value", []),
    (4, None, None, None, None, None),
    (5, None, None, None, None, None),
    (6, None, None, None, None, None),
]

# Empty arrays are present values. They are the ones a '' comparison silently
# counts, because SQLAlchemy binds the '' as an empty array.
ARRAY_ROWS = [
    (1, ["a value"], [7]),
    (2, [], []),
    (3, None, None),
    (4, None, None),
    (5, None, None),
]

EXPECTED_NULL_COUNT = 3
EXPECTED_NULL_AND_EMPTY_COUNT = 5


def _seed(engine):
    Base.metadata.create_all(bind=engine)
    session = create_and_bind_session(engine)
    session.add_all(
        [
            MissingCountTestTable(
                row_id=row_id,
                int_col=int_col,
                date_col=date_col,
                bool_col=bool_col,
                str_col=str_col,
                json_col=json_col,
            )
            for row_id, int_col, date_col, bool_col, str_col, json_col in ROWS
        ]
    )
    session.commit()
    return session


def _seed_arrays(engine, session):
    ArrayBase.metadata.create_all(bind=engine)
    session.add_all(
        [
            ArrayMissingCountTestTable(
                row_id=row_id,
                str_array_col=str_array_col,
                int_array_col=int_array_col,
            )
            for row_id, str_array_col, int_array_col in ARRAY_ROWS
        ]
    )
    session.commit()


@pytest.fixture(scope="module")
def postgres_session():
    with PostgresContainer("postgres:15") as container:
        engine = create_engine(container.get_connection_url())
        session = _seed(engine)
        _seed_arrays(engine, session)
        yield session
        session.close()
        engine.dispose()


@pytest.fixture(scope="module")
def mysql_session():
    with MySqlContainer(image="mysql:8.4.5", dbname="test_missing_count") as container:
        engine = create_engine(container.get_connection_url())
        session = _seed(engine)
        yield session
        session.close()
        engine.dispose()


@pytest.fixture(params=["postgres", "mysql"])
def session(request):
    session = request.getfixturevalue(f"{request.param}_session")
    yield session
    # Postgres refuses every statement after a failed one until the transaction is
    # rolled back, so one real failure would cascade into the other tests.
    session.rollback()


@pytest.fixture
def array_session(postgres_session):
    """Postgres-only session, rolled back for the same reason as `session`"""
    yield postgres_session
    postgres_session.rollback()


def run_null_missing_count(session, column, table=None) -> int:
    metric_fn = Metrics.nullMissingCount(column).fn()
    table = table if table is not None else MissingCountTestTable.__table__
    return int(session.execute(select(metric_fn).select_from(table)).scalar())


def test_integer_column_counts_nulls_only(session):
    """Zeros are not missing values: on MySQL '' would coerce to 0 and count them"""
    assert run_null_missing_count(session, MissingCountTestTable.int_col) == EXPECTED_NULL_COUNT


def test_date_column_counts_nulls_only(session):
    assert run_null_missing_count(session, MissingCountTestTable.date_col) == EXPECTED_NULL_COUNT


def test_boolean_column_counts_nulls_only(session):
    """False is not a missing value: on MySQL '' would coerce to 0 and count them"""
    assert run_null_missing_count(session, MissingCountTestTable.bool_col) == EXPECTED_NULL_COUNT


def test_string_column_counts_nulls_and_empty_strings(session):
    assert run_null_missing_count(session, MissingCountTestTable.str_col) == EXPECTED_NULL_AND_EMPTY_COUNT


def test_json_column_counts_nulls_only(session):
    """An empty object or array is a present value, and Postgres has no json = text"""
    assert run_null_missing_count(session, MissingCountTestTable.json_col) == EXPECTED_NULL_COUNT


@pytest.mark.parametrize("column_name", ["str_array_col", "int_array_col"])
def test_array_column_counts_nulls_only(array_session, column_name):
    """Empty arrays are not missing: '' binds as an empty array and would match them"""
    column = getattr(ArrayMissingCountTestTable, column_name)

    assert (
        run_null_missing_count(
            array_session,
            column,
            table=ArrayMissingCountTestTable.__table__,
        )
        == EXPECTED_NULL_COUNT
    )
