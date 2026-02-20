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
Integration tests for CockroachTableMetricComputer against a real CockroachDB database.
"""

from unittest.mock import Mock

import pytest
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base
from testcontainers.cockroachdb import CockroachDBContainer

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.orm.functions.table_metric_computer import (
    CockroachTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner

Base = declarative_base()


class MetricComputerTestTable(Base):
    __tablename__ = "metric_computer_test"
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


class NonExistentModel(Base):
    __tablename__ = "nonexistent_table_xyz"
    __table_args__ = {"schema": "public"}
    id = Column(Integer, primary_key=True)


@pytest.fixture(scope="module")
def crdb_engine():
    container = CockroachDBContainer(image="cockroachdb/cockroach:v23.1.0")
    with container as container:
        container.exec(
            "cockroach sql --insecure -e "
            "'GRANT SELECT ON TABLE system.table_statistics TO cockroach'"
        )
        engine = create_engine(container.get_connection_url())
        engine.execute(
            "CREATE TABLE IF NOT EXISTS public.metric_computer_test "
            "(id INTEGER PRIMARY KEY, name VARCHAR(256))"
        )
        engine.execute(
            "INSERT INTO public.metric_computer_test (id, name) "
            "SELECT g, 'name_' || g::text FROM generate_series(1, 100) AS g"
        )
        engine.execute("ANALYZE metric_computer_test")
        yield engine
        engine.dispose()


@pytest.fixture()
def session(crdb_engine):
    session = create_and_bind_session(crdb_engine)
    yield session
    session.close()


def _build_computer(session, model, table_type):
    runner = QueryRunner(
        session=session,
        dataset=model,
        raw_dataset=model,
    )
    entity = Mock()
    entity.tableType = table_type
    computer = CockroachTableMetricComputer(
        runner=runner,
        metrics=[],
        conn_config=None,
        entity=entity,
    )
    computer._set_table_and_schema_name()
    return computer


class TestCockroachTableMetricComputer:
    def test_compute_returns_row_count(self, session):
        computer = _build_computer(session, MetricComputerTestTable, TableType.Regular)
        result = computer.compute()
        assert result is not None
        assert result.rowCount == 100

    def test_compute_returns_column_metadata(self, session):
        computer = _build_computer(session, MetricComputerTestTable, TableType.Regular)
        result = computer.compute()
        assert result is not None
        assert result.columnCount == 2
        assert "id" in result.columnNames
        assert "name" in result.columnNames
