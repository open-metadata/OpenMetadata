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
"""The default profiler and the sampler run their generic SQL against a real DuckDB file."""

from unittest.mock import patch
from uuid import uuid4

import duckdb
import pytest
from sqlalchemy import BigInteger, Column, Date, Numeric, String
from sqlalchemy.orm import DeclarativeBase

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.duckDBConnection import (
    DuckDBConnection,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.processor.default import DefaultProfiler
from metadata.sampler.sqlalchemy.sampler import SQASampler

DUCKDB_TEST_CONFIG = {"threads": "1", "memory_limit": "256MB"}


class Base(DeclarativeBase):
    pass


class Orders(Base):
    __tablename__ = "orders"
    __table_args__ = {"schema": "main"}  # noqa: RUF012
    id = Column(BigInteger, primary_key=True)
    customer = Column(String)
    total = Column(Numeric(12, 2))
    placed = Column(Date)


ORDERS = [
    (1, "ada", 10.00, "2026-01-01"),
    (2, "alan", 20.00, "2026-01-02"),
    (3, "grace", 30.00, "2026-01-03"),
    (4, None, 40.00, "2026-01-04"),
]


@pytest.fixture
def profiler_interface(tmp_path):
    path = tmp_path / "shop.duckdb"
    with duckdb.connect(str(path), config=DUCKDB_TEST_CONFIG) as conn:
        conn.execute("CREATE TABLE orders (id BIGINT PRIMARY KEY, customer VARCHAR, total DECIMAL(12, 2), placed DATE)")
        conn.executemany("INSERT INTO orders VALUES (?, ?, ?, ?)", ORDERS)

    connection = DuckDBConnection(databaseFilePath=str(path), connectionOptions=DUCKDB_TEST_CONFIG)
    table = Table(
        id=uuid4(),
        name="orders",
        columns=[
            EntityColumn(name=ColumnName("id"), dataType=DataType.BIGINT),
            EntityColumn(name=ColumnName("customer"), dataType=DataType.VARCHAR),
            EntityColumn(name=ColumnName("total"), dataType=DataType.DECIMAL),
            EntityColumn(name=ColumnName("placed"), dataType=DataType.DATE),
        ],
    )
    with patch.object(SQASampler, "build_table_orm", return_value=Orders):
        sampler = SQASampler(service_connection_config=connection, ometa_client=None, entity=table)
    return SQAProfilerInterface(connection, None, table, None, sampler, 1, 600)


def test_duckdb_is_a_registered_profiler_dialect():
    assert Dialects.DuckDB == "duckdb"


def test_default_profiler_metrics(profiler_interface):
    profiler = DefaultProfiler(profiler_interface=profiler_interface, metrics_registry=Metrics)
    profiler.compute_metrics()
    profile = profiler.get_profile()
    columns = {column.name: column for column in profile.columnProfile}

    assert (profile.tableProfile.rowCount, profile.tableProfile.columnCount) == (4, 4)

    total = columns["total"]
    assert (total.min, total.max, total.sum, total.mean) == (10.0, 40.0, 100.0, 25.0)
    assert (total.firstQuartile, total.median, total.thirdQuartile) == (17.5, 25.0, 32.5)
    assert total.stddev == pytest.approx(11.18, abs=0.01)

    customer = columns["customer"]
    assert (customer.nullCount, customer.distinctCount) == (1, 3)
    assert (customer.min, customer.max) == (3, 5), "string statistics are computed over LEN()"


def test_sample_data(profiler_interface):
    sample = profiler_interface.sampler.fetch_sample_data()

    assert [column.root for column in sample.columns] == ["id", "customer", "total", "placed"]
    assert len(sample.rows) == len(ORDERS)
