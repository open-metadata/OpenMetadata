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
Integration tests for ClickHouseTableMetricComputer against a real ClickHouse database.
"""

from unittest.mock import Mock, patch

import pytest
from sqlalchemy import Column, Integer, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase
from testcontainers.clickhouse import ClickHouseContainer

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.orm.functions.table_metric_computer import (
    BaseTableMetricComputer,
    ClickHouseTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner


class Base(DeclarativeBase):
    pass


class MetricComputerTestTable(Base):
    __tablename__ = "metric_computer_test"
    __table_args__ = {"schema": "default"}  # noqa: RUF012
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


class NonExistentModel(Base):
    __tablename__ = "nonexistent_table_xyz"
    __table_args__ = {"schema": "default"}  # noqa: RUF012
    id = Column(Integer, primary_key=True)


@pytest.fixture(scope="module")
def ch_engine():
    container = ClickHouseContainer("clickhouse/clickhouse-server:24.3")
    with container as container:
        host = container.get_container_host_ip()
        http_port = container.get_exposed_port(8123)
        url = f"clickhouse+http://{container.username}:{container.password}@{host}:{http_port}/{container.dbname}"
        engine = create_engine(url)
        with engine.connect() as conn:
            conn.execute(
                text(
                    "CREATE TABLE default.metric_computer_test "
                    "(id UInt32, name String) ENGINE = MergeTree() ORDER BY id"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO default.metric_computer_test "
                    "SELECT number, concat('name_', toString(number)) "
                    "FROM numbers(100)"
                )
            )
            conn.commit()
        yield engine
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS default.metric_computer_test"))
            conn.commit()
        engine.dispose()


@pytest.fixture(scope="module")
def session(ch_engine):
    session = create_and_bind_session(ch_engine)
    yield session
    session.close()


def _build_computer(session, model, table_type=TableType.Regular):
    runner = QueryRunner(
        session=session,
        dataset=model,
        raw_dataset=model,
    )
    entity = Mock()
    entity.tableType = table_type
    computer = ClickHouseTableMetricComputer(
        runner=runner,
        metrics=[],
        conn_config=None,
        entity=entity,
    )
    computer._set_table_and_schema_name()
    return computer


class TestClickHouseTableMetricComputer:
    def test_compute_returns_row_count_and_size(self, session):
        computer = _build_computer(session, MetricComputerTestTable)
        with patch.object(
            BaseTableMetricComputer,
            "compute",
            wraps=BaseTableMetricComputer.compute,
        ) as fallback:
            result = computer.compute()
        assert result is not None
        assert result.rowCount == 100
        assert result.sizeInBytes > 0
        fallback.assert_not_called()

    def test_compute_returns_column_metadata(self, session):
        computer = _build_computer(session, MetricComputerTestTable)
        with patch.object(
            BaseTableMetricComputer,
            "compute",
            wraps=BaseTableMetricComputer.compute,
        ) as fallback:
            result = computer.compute()
        assert result is not None
        assert result.columnCount == 2
        assert "id" in result.columnNames
        assert "name" in result.columnNames
        fallback.assert_not_called()

    def test_compute_nonexistent_table_returns_none(self, session):
        computer = _build_computer(session, NonExistentModel)
        result = computer.compute()
        assert result is None
