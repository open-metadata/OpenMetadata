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
from sqlalchemy.orm import DeclarativeBase

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


class Base(DeclarativeBase):
    pass


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
        assert table_metric_computer_factory._constructs.get(Dialects.MariaDB) is MySQLTableMetricComputer
        assert table_metric_computer_factory._constructs.get(Dialects.SingleStore) is MySQLTableMetricComputer
        assert table_metric_computer_factory._constructs.get(Dialects.StarRocks) is MySQLTableMetricComputer
        assert table_metric_computer_factory._constructs.get(Dialects.Doris) is MySQLTableMetricComputer

    def test_mssql_registrations(self):
        assert table_metric_computer_factory._constructs.get(Dialects.MSSQL) is MSSQLTableMetricComputer
        assert table_metric_computer_factory._constructs.get(Dialects.AzureSQL) is MSSQLTableMetricComputer

    def test_cockroach_registration(self):
        assert table_metric_computer_factory._constructs.get(Dialects.Cockroach) is CockroachTableMetricComputer

    def test_db2_registration(self):
        assert table_metric_computer_factory._constructs.get(Dialects.Db2) is DB2TableMetricComputer

    def test_vertica_registration(self):
        assert table_metric_computer_factory._constructs.get(Dialects.Vertica) is VerticaTableMetricComputer

    def test_hana_registration(self):
        assert table_metric_computer_factory._constructs.get(Dialects.Hana) is SAPHanaTableMetricComputer


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
        computer = _build_computer(session, DB2TableMetricComputer, table_type=TableType.View)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_returns_result_for_zero_row_count_regular_table(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, DB2TableMetricComputer, table_type=TableType.Regular)
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
        computer = _build_computer(session, VerticaTableMetricComputer, table_type=TableType.View)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_returns_result_for_zero_row_count_regular_table(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, VerticaTableMetricComputer, table_type=TableType.Regular)
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

    def test_compute_queries_create_time_from_sys_tables_not_m_tables(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 100
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, SAPHanaTableMetricComputer)
        computer.compute()
        sql = str(session.execute.call_args[0][0].compile())
        assert '"SYS"."TABLES"' in sql or "SYS.TABLES" in sql, "CREATE_TIME must come from SYS.TABLES, not SYS.M_TABLES"
        assert "CREATE_TIME" in sql
        assert "M_TABLES" in sql

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
        computer = _build_computer(session, SAPHanaTableMetricComputer, table_type=TableType.View)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_returns_result_for_zero_row_count_regular_table(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, SAPHanaTableMetricComputer, table_type=TableType.Regular)
        result = computer.compute()
        assert result is mock_result

    def test_compute_uppercases_schema_and_table_in_where_clause(self):
        """MockModel has lowercase schema='test_schema' and table='test_table'.
        HANA catalog stores identifiers in uppercase — WHERE must use .upper()."""
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 10
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, SAPHanaTableMetricComputer)
        computer.compute()
        sql = str(session.execute.call_args[0][0].compile(compile_kwargs={"literal_binds": True}))
        assert "TEST_SCHEMA" in sql, f"WHERE clause must use uppercased schema name, got: {sql}"
        assert "TEST_TABLE" in sql, f"WHERE clause must use uppercased table name, got: {sql}"
        assert "test_schema" not in sql.split("FROM")[1] if "FROM" in sql else True, (
            "Lowercase schema name must not appear in WHERE clauses"
        )

    def test_compute_returns_result_when_create_time_is_none(self):
        """LEFT JOIN means CREATE_TIME can be NULL (table in M_TABLES but not TABLES).
        Should still return result — not fall back to base compute."""
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 50
        mock_result.createDateTime = None
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, SAPHanaTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback") as base_compute:
            result = computer.compute()
            assert result is mock_result
            base_compute.assert_not_called()

    def test_compute_uses_two_ctes_with_left_join(self):
        """Query must have two CTEs (M_TABLES + TABLES) joined with LEFT OUTER JOIN."""
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 10
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, SAPHanaTableMetricComputer)
        computer.compute()
        sql = str(session.execute.call_args[0][0].compile(compile_kwargs={"literal_binds": True}))
        sql_upper = sql.upper()
        normalized_sql = " ".join(sql_upper.split())
        sql_without_quotes = normalized_sql.replace('"', "")
        assert "WITH " in normalized_sql, f"Expected WITH clause in query, got: {sql}"
        assert sql_without_quotes.count(" AS (") >= 2, f"Expected two CTE definitions in query, got: {sql}"
        assert "FROM SYS.M_TABLES" in sql_without_quotes, f"Expected M_TABLES source in query, got: {sql}"
        assert "FROM SYS.TABLES" in sql_without_quotes, f"Expected TABLES source in query, got: {sql}"
        assert "LEFT OUTER JOIN" in normalized_sql or "LEFT JOIN" in normalized_sql, (
            f"TABLES CTE must be LEFT JOINed, got: {sql}"
        )

    def test_compute_returns_none_for_nonexistent_table(self):
        """When table absent from HANA system views, compute returns None and
        still queries using uppercased identifiers expected by the catalog."""
        session = _build_mock_session()
        session.execute.return_value.first.return_value = None
        computer = _build_computer(session, SAPHanaTableMetricComputer)
        result = computer.compute()
        sql = str(session.execute.call_args[0][0].compile(compile_kwargs={"literal_binds": True}))
        assert result is None
        assert "TEST_SCHEMA" in sql, f"Nonexistent-table lookup must use uppercased schema, got: {sql}"
        assert "TEST_TABLE" in sql, f"Nonexistent-table lookup must use uppercased table, got: {sql}"

    def test_compute_includes_column_count_and_names(self):
        """Result query must include columnCount and columnNames labels."""
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 10
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, SAPHanaTableMetricComputer)
        computer.compute()
        sql = str(session.execute.call_args[0][0].compile(compile_kwargs={"literal_binds": True}))
        assert "columnCount" in sql, f"Query must select columnCount, got: {sql}"
        assert "columnNames" in sql, f"Query must select columnNames, got: {sql}"
