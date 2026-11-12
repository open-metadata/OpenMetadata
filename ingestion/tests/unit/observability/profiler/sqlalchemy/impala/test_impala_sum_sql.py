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

"""Execute Impala4 SUM SQL against SQLite to check exact BIGINT arithmetic."""

import pytest
from sqlalchemy import BigInteger, Column, MetaData, Table, create_engine, select

from metadata.profiler.orm.functions.sum import SumFn
from metadata.profiler.orm.registry import Dialects


@pytest.fixture
def impala4_dialect():
    pytest.importorskip("impala.sqlalchemy")
    engine = create_engine("impala4://")
    try:
        assert engine.dialect.name == Dialects.Impala4
        yield engine.dialect
    finally:
        engine.dispose()


@pytest.fixture
def sqlite_engine():
    engine = create_engine("sqlite:///:memory:")
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "values,expected",
    [
        ((9007199254740993, -9007199254740992), 1),
        ((-9007199254740993, 9007199254740992), -1),
        ((9007199254740995, -9007199254740992), 3),
        ((-9007199254740995, 9007199254740992), -3),
    ],
    ids=["positive-one", "negative-one", "positive-three", "negative-three"],
)
def test_impala4_sum_preserves_bigint_cancellation(impala4_dialect, sqlite_engine, values, expected):
    table = Table("sum_values", MetaData(), Column("value", BigInteger))
    table.create(sqlite_engine)
    query = select(SumFn(table.c.value))
    sql = str(query.compile(dialect=impala4_dialect))

    with sqlite_engine.begin() as connection:
        connection.execute(table.insert(), [{"value": value} for value in values])
        result = connection.exec_driver_sql(sql).scalar_one()

    assert result == expected
