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
Integration tests for PostgresTableMetricComputer against a real PostgreSQL database.
"""

import sys
from unittest.mock import Mock

import pytest
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base

from _openmetadata_testutils.postgres.conftest import postgres_container  # noqa: F401
from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.orm.functions.table_metric_computer import (
    PostgresTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner

if not sys.version_info >= (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


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
def pg_engine(postgres_container):  # noqa: F811
    engine = create_engine(postgres_container.get_connection_url())
    engine.execute(
        "CREATE TABLE IF NOT EXISTS public.metric_computer_test "
        "(id INTEGER PRIMARY KEY, name VARCHAR(256))"
    )
    engine.execute(
        "INSERT INTO public.metric_computer_test (id, name) "
        "SELECT g, 'name_' || g FROM generate_series(1, 100) AS g"
    )
    engine.execute("ANALYZE public.metric_computer_test")
    yield engine
    engine.execute("DROP TABLE IF EXISTS public.metric_computer_test")
    engine.dispose()


@pytest.fixture(scope="module")
def session(pg_engine):
    session = create_and_bind_session(pg_engine)
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
    computer = PostgresTableMetricComputer(
        runner=runner,
        metrics=[],
        conn_config=None,
        entity=entity,
    )
    computer._set_table_and_schema_name()
    return computer


class TestPostgresTableMetricComputer:
    def test_compute_returns_row_count_and_size(self, session):
        computer = _build_computer(session, MetricComputerTestTable, TableType.Regular)
        result = computer.compute()
        assert result is not None
        assert result.rowCount == 100
        assert result.sizeInBytes > 0

    def test_compute_returns_column_metadata(self, session):
        computer = _build_computer(session, MetricComputerTestTable, TableType.Regular)
        result = computer.compute()
        assert result is not None
        assert result.columnCount == 2
        assert "id" in result.columnNames
        assert "name" in result.columnNames

    def test_compute_nonexistent_table_returns_none(self, session):
        computer = _build_computer(session, NonExistentModel, TableType.Regular)
        result = computer.compute()
        assert result is None

    def test_compute_does_not_return_create_datetime(self, session):
        computer = _build_computer(session, MetricComputerTestTable, TableType.Regular)
        result = computer.compute()
        assert result is not None
        assert "createDateTime" not in result._asdict()
