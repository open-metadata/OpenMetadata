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
Integration tests for HiveTableMetricComputer against a real HiveServer2.
Uses apache/hive with embedded Derby metastore (single container).
"""

from unittest.mock import Mock, patch

import pytest
from sqlalchemy import Column, Integer, String, create_engine, text
from sqlalchemy.orm import DeclarativeBase
from tenacity import retry, stop_after_delay, wait_fixed
from testcontainers.core.container import DockerContainer

from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.orm.functions.table_metric_computer import (
    BaseTableMetricComputer,
    HiveTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner


class HiveServer2Container(DockerContainer):
    """HiveServer2 with embedded Derby metastore."""

    def __init__(self, image="apache/hive:4.0.1"):
        super().__init__(image)
        self.port = 10000
        self.with_exposed_ports(self.port)
        self.with_env("SERVICE_NAME", "hiveserver2")

    def get_connection_url(self):
        host = self.get_container_host_ip()
        port = self.get_exposed_port(self.port)
        return f"hive://{host}:{port}/default"

    def start(self):
        super().start()
        self._wait_for_hiveserver2()
        return self

    @retry(wait=wait_fixed(5), stop=stop_after_delay(120))
    def _wait_for_hiveserver2(self):
        engine = create_engine(self.get_connection_url())
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        finally:
            engine.dispose()


class Base(DeclarativeBase):
    pass


class MetricComputerTestTable(Base):
    __tablename__ = "metric_test"
    __table_args__ = {"schema": "default"}  # noqa: RUF012
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


@pytest.fixture(scope="module")
def hive_engine():
    container = HiveServer2Container()
    with try_bind(container, 10000, None) as container:
        engine = create_engine(container.get_connection_url())
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE IF NOT EXISTS default.metric_test (id INT, name STRING)"))
            conn.execute(
                text("INSERT INTO default.metric_test VALUES " + ", ".join(f"({i}, 'name_{i}')" for i in range(1, 101)))
            )
            conn.execute(text("ANALYZE TABLE default.metric_test COMPUTE STATISTICS"))
        yield engine
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS default.metric_test"))
        engine.dispose()


@pytest.fixture(scope="module")
def session(hive_engine):
    session = create_and_bind_session(hive_engine)
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
    computer = HiveTableMetricComputer(
        runner=runner,
        metrics=[],
        conn_config=None,
        entity=entity,
    )
    computer._set_table_and_schema_name()
    return computer


class TestHiveTableMetricComputer:
    def test_describe_formatted_returns_row_count(self, session):
        """ANALYZE populates numRows in DESCRIBE FORMATTED output."""
        computer = _build_computer(session, MetricComputerTestTable)
        with patch.object(
            BaseTableMetricComputer,
            "compute",
            wraps=BaseTableMetricComputer.compute,
        ) as fallback:
            result = computer.compute()
        assert result is not None
        assert result.rowCount == 100
        fallback.assert_not_called()

    def test_result_includes_column_metadata(self, session):
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
