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
Unit tests for new TableMetricComputer implementations and factory registrations.
Covers DB2, Vertica, SAP HANA (no testcontainer infrastructure) with mocked sessions,
and verifies all new dialect-to-class factory registrations.
"""

from unittest.mock import MagicMock, Mock, patch

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import TableType
from metadata.profiler.orm.functions.table_metric_computer import (
    BaseTableMetricComputer,
    CockroachTableMetricComputer,
    DB2TableMetricComputer,
    MSSQLTableMetricComputer,
    MySQLTableMetricComputer,
    SAPHanaTableMetricComputer,
    VerticaTableMetricComputer,
    table_metric_computer_factory,
)
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.processor.runner import QueryRunner

Base = declarative_base()


class MockModel(Base):
    __tablename__ = "test_table"
    __table_args__ = {"schema": "test_schema"}
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


def _build_mock_session(db_name="test_db"):
    session = MagicMock()
    mock_bind = MagicMock()
    mock_bind.url.database = db_name
    session.get_bind.return_value = mock_bind
    return session


def _build_computer(session, computer_class, table_type=TableType.Regular):
    runner = QueryRunner(
        session=session,
        dataset=MockModel,
        raw_dataset=MockModel,
    )
    entity = Mock()
    entity.tableType = table_type
    computer = computer_class(
        runner=runner,
        metrics=[],
        conn_config=None,
        entity=entity,
    )
    computer._set_table_and_schema_name()
    return computer


class TestFactoryRegistrations:
    def test_mysql_compatible_registrations(self):
        assert (
            table_metric_computer_factory._constructs.get(Dialects.MariaDB)
            is MySQLTableMetricComputer
        )
        assert (
            table_metric_computer_factory._constructs.get(Dialects.SingleStore)
            is MySQLTableMetricComputer
        )
        assert (
            table_metric_computer_factory._constructs.get(Dialects.StarRocks)
            is MySQLTableMetricComputer
        )
        assert (
            table_metric_computer_factory._constructs.get(Dialects.Doris)
            is MySQLTableMetricComputer
        )

    def test_mssql_registrations(self):
        assert (
            table_metric_computer_factory._constructs.get(Dialects.MSSQL)
            is MSSQLTableMetricComputer
        )
        assert (
            table_metric_computer_factory._constructs.get(Dialects.AzureSQL)
            is MSSQLTableMetricComputer
        )

    def test_cockroach_registration(self):
        assert (
            table_metric_computer_factory._constructs.get(Dialects.Cockroach)
            is CockroachTableMetricComputer
        )

    def test_db2_registration(self):
        assert (
            table_metric_computer_factory._constructs.get(Dialects.Db2)
            is DB2TableMetricComputer
        )

    def test_vertica_registration(self):
        assert (
            table_metric_computer_factory._constructs.get(Dialects.Vertica)
            is VerticaTableMetricComputer
        )

    def test_hana_registration(self):
        assert (
            table_metric_computer_factory._constructs.get(Dialects.Hana)
            is SAPHanaTableMetricComputer
        )


class TestDB2TableMetricComputer:
    def test_compute_returns_result(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 1000
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, DB2TableMetricComputer)
        result = computer.compute()
        assert result is mock_result
        assert result.rowCount == 1000

    def test_compute_returns_none_when_no_result(self):
        session = _build_mock_session()
        session.execute.return_value.first.return_value = None
        computer = _build_computer(session, DB2TableMetricComputer)
        result = computer.compute()
        assert result is None

    def test_compute_fallback_on_none_row_count(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = None
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, DB2TableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_fallback_on_negative_row_count(self):
        """DB2 CARD = -1 means stats not collected"""
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = -1
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, DB2TableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_fallback_on_zero_row_count_for_view(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(
            session, DB2TableMetricComputer, table_type=TableType.View
        )
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_returns_result_for_zero_row_count_regular_table(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(
            session, DB2TableMetricComputer, table_type=TableType.Regular
        )
        result = computer.compute()
        assert result is mock_result


class TestVerticaTableMetricComputer:
    def test_compute_returns_result(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 5000
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, VerticaTableMetricComputer)
        result = computer.compute()
        assert result is mock_result
        assert result.rowCount == 5000

    def test_compute_returns_none_when_no_result(self):
        session = _build_mock_session()
        session.execute.return_value.first.return_value = None
        computer = _build_computer(session, VerticaTableMetricComputer)
        result = computer.compute()
        assert result is None

    def test_compute_fallback_on_none_row_count(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = None
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, VerticaTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_fallback_on_zero_row_count_for_view(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(
            session, VerticaTableMetricComputer, table_type=TableType.View
        )
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_returns_result_for_zero_row_count_regular_table(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(
            session, VerticaTableMetricComputer, table_type=TableType.Regular
        )
        result = computer.compute()
        assert result is mock_result


class TestSAPHanaTableMetricComputer:
    def test_compute_returns_result(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 2500
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, SAPHanaTableMetricComputer)
        result = computer.compute()
        assert result is mock_result
        assert result.rowCount == 2500

    def test_compute_returns_none_when_no_result(self):
        session = _build_mock_session()
        session.execute.return_value.first.return_value = None
        computer = _build_computer(session, SAPHanaTableMetricComputer)
        result = computer.compute()
        assert result is None

    def test_compute_fallback_on_none_row_count(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = None
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, SAPHanaTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_fallback_on_zero_row_count_for_view(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(
            session, SAPHanaTableMetricComputer, table_type=TableType.View
        )
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_returns_result_for_zero_row_count_regular_table(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(
            session, SAPHanaTableMetricComputer, table_type=TableType.Regular
        )
        result = computer.compute()
        assert result is mock_result
