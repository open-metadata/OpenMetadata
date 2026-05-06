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
Integration tests for TrinoTableMetricComputer against a real Trino database.
Verifies SHOW STATS parsing returns accurate row counts after ANALYZE.
"""

from unittest.mock import Mock, patch

import pytest
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.orm.functions.table_metric_computer import (
    BaseTableMetricComputer,
    TrinoTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner


class Base(DeclarativeBase):
    pass


class TitanicModel(Base):
    __tablename__ = "titanic"
    __table_args__ = {"schema": "my_schema"}  # noqa: RUF012
    passengerid = Column(Integer, primary_key=True)
    name = Column(String(256))


class EmptyModel(Base):
    __tablename__ = "empty"
    __table_args__ = {"schema": "my_schema"}  # noqa: RUF012
    id = Column(Integer, primary_key=True)


@pytest.fixture(scope="module")
def trino_engine(trino_container, create_test_data):
    engine = create_engine(make_url(trino_container.get_connection_url()).set(database="minio"))
    yield engine
    engine.dispose()


@pytest.fixture(scope="module")
def trino_session(trino_engine):
    session = create_and_bind_session(trino_engine)
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
    computer = TrinoTableMetricComputer(
        runner=runner,
        metrics=[],
        conn_config=None,
        entity=entity,
    )
    computer._set_table_and_schema_name()
    return computer


class TestTrinoTableMetricComputer:
    def test_show_stats_returns_row_count(self, trino_session):
        """titanic table has 891 rows; ANALYZE was run by create_test_data."""
        computer = _build_computer(trino_session, TitanicModel)
        with patch.object(
            BaseTableMetricComputer,
            "compute",
            wraps=BaseTableMetricComputer.compute,
        ) as fallback:
            result = computer.compute()
        assert result is not None
        assert result.rowCount == 891
        fallback.assert_not_called()

    def test_show_stats_returns_column_metadata(self, trino_session):
        computer = _build_computer(trino_session, TitanicModel)
        with patch.object(
            BaseTableMetricComputer,
            "compute",
            wraps=BaseTableMetricComputer.compute,
        ) as fallback:
            result = computer.compute()
        assert result is not None
        assert result.columnCount == 2
        assert "passengerid" in result.columnNames
        assert "name" in result.columnNames
        fallback.assert_not_called()

    def test_empty_table_with_dropped_stats_falls_back(self, trino_session):
        """empty table had stats dropped — SHOW STATS returns NULL row_count.
        Should fall back to COUNT(*)."""
        computer = _build_computer(trino_session, EmptyModel)
        fallback_result = Mock(rowCount=0, columnCount=None, sizeInBytes=None, columnNames=None, createDateTime=None)
        with patch.object(
            BaseTableMetricComputer,
            "compute",
            return_value=fallback_result,
        ) as fallback:
            result = computer.compute()
        assert result is not None
        assert result.rowCount == 0
        fallback.assert_called_once()
