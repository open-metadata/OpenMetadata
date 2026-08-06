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
"""

import datetime

import pytest
from sqlalchemy import Boolean, Column, Date, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase
from testcontainers.mysql import MySqlContainer
from testcontainers.postgres import PostgresContainer

from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.metrics.registry import Metrics


class Base(DeclarativeBase):
    pass


class MissingCountTestTable(Base):
    __tablename__ = "missing_count_test"
    row_id = Column(Integer, primary_key=True)
    int_col = Column(Integer)
    date_col = Column(Date)
    bool_col = Column(Boolean)
    str_col = Column(String(64))


# 3 NULLs per column, plus the values MySQL would coerce '' into: 2 zeros in
# int_col and 2 false in bool_col. Only the NULLs are missing for those columns;
# str_col also counts its 2 empty strings.
ROWS = [
    (1, 0, datetime.date(2024, 1, 1), False, ""),
    (2, 0, datetime.date(2024, 1, 2), False, ""),
    (3, 7, datetime.date(2024, 1, 3), True, "a value"),
    (4, None, None, None, None),
    (5, None, None, None, None),
    (6, None, None, None, None),
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
            )
            for row_id, int_col, date_col, bool_col, str_col in ROWS
        ]
    )
    session.commit()
    return session


@pytest.fixture(scope="module")
def postgres_session():
    with PostgresContainer("postgres:15") as container:
        engine = create_engine(container.get_connection_url())
        session = _seed(engine)
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


def run_null_missing_count(session, column) -> int:
    metric_fn = Metrics.nullMissingCount(column).fn()
    return int(session.execute(select(metric_fn).select_from(MissingCountTestTable.__table__)).scalar())


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
