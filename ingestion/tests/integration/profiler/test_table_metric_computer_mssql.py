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
Integration tests for MSSQLTableMetricComputer against a real SQL Server database.
"""

from unittest.mock import Mock

import pytest
from sqlalchemy import Column, Integer, String, create_engine, text
from sqlalchemy.orm import declarative_base
from testcontainers.mssql import SqlServerContainer

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.orm.functions.table_metric_computer import (
    MSSQLTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner

Base = declarative_base()


class MetricComputerTestTable(Base):
    __tablename__ = "metric_computer_test"
    __table_args__ = {"schema": "dbo"}
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


class NonExistentModel(Base):
    __tablename__ = "nonexistent_table_xyz"
    __table_args__ = {"schema": "dbo"}
    id = Column(Integer, primary_key=True)


@pytest.fixture(scope="module")
def mssql_engine():
    container = SqlServerContainer(
        "mcr.microsoft.com/mssql/server:2022-latest", dbname="master"
    )
    with container as container:
        url = "mssql+pytds://" + container.get_connection_url().split("://")[1]
        engine = create_engine(url, connect_args={"autocommit": True})
        with engine.connect() as conn:
            conn.execute(
                text(
                    "CREATE TABLE dbo.metric_computer_test "
                    "(id INT PRIMARY KEY, name NVARCHAR(256))"
                )
            )
            values = ", ".join(f"({i}, 'name_{i}')" for i in range(1, 101))
            conn.execute(
                text(f"INSERT INTO dbo.metric_computer_test (id, name) VALUES {values}")
            )
        yield engine
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS dbo.metric_computer_test"))
        engine.dispose()


@pytest.fixture(scope="module")
def session(mssql_engine):
    session = create_and_bind_session(mssql_engine)
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
    computer = MSSQLTableMetricComputer(
        runner=runner,
        metrics=[],
        conn_config=None,
        entity=entity,
    )
    computer._set_table_and_schema_name()
    return computer


class TestMSSQLTableMetricComputer:
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

    def test_compute_returns_create_datetime(self, session):
        computer = _build_computer(session, MetricComputerTestTable, TableType.Regular)
        result = computer.compute()
        assert result is not None
        assert result.createDateTime is not None

    def test_compute_nonexistent_table_returns_none(self, session):
        computer = _build_computer(session, NonExistentModel, TableType.Regular)
        result = computer.compute()
        assert result is None
