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
    DatabricksTableMetricComputer,
    DB2TableMetricComputer,
    ExasolTableMetricComputer,
    HiveTableMetricComputer,
    ImpalaTableMetricComputer,
    MSSQLTableMetricComputer,
    MySQLTableMetricComputer,
    SAPHanaTableMetricComputer,
    TeradataTableMetricComputer,
    TrinoTableMetricComputer,
    VerticaTableMetricComputer,
    table_metric_computer_factory,
)
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.processor.runner import QueryRunner


class Base(DeclarativeBase):
    pass


class MockModel(Base):
    __tablename__ = "test_table"
    __table_args__ = {"schema": "test_schema"}  # noqa: RUF012
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


class TestDialectStringValidation:
    """Verify Dialects enum values match actual SQLAlchemy dialect names."""

    def test_exasol_dialect_matches_driver(self):
        from sqlalchemy_exasol.base import EXADialect

        assert Dialects.Exasol == EXADialect.name

    def test_teradata_dialect_matches_driver(self):
        from teradatasqlalchemy.dialect import TeradataDialect

        assert Dialects.Teradata == TeradataDialect.name


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


class TestExasolTableMetricComputer:
    def test_exasol_registration(self):
        assert table_metric_computer_factory._constructs.get(Dialects.Exasol) is ExasolTableMetricComputer

    def test_compute_uses_view_metrics_for_views(self):
        session = _build_mock_session()
        computer = _build_computer(session, ExasolTableMetricComputer, table_type=TableType.View)

        with patch.object(ExasolTableMetricComputer, "_compute_view_metrics", return_value="view-metrics") as mock_view:
            result = computer.compute()

        assert result == "view-metrics"
        mock_view.assert_called_once_with()

    def test_compute_uses_view_metrics_for_materialized_views(self):
        session = _build_mock_session()
        computer = _build_computer(session, ExasolTableMetricComputer, table_type=TableType.MaterializedView)

        with patch.object(ExasolTableMetricComputer, "_compute_view_metrics", return_value="view-metrics") as mock_view:
            result = computer.compute()

        assert result == "view-metrics"
        mock_view.assert_called_once_with()

    def test_compute_view_metrics_falls_back_to_base_compute(self):
        session = _build_mock_session()
        computer = _build_computer(session, ExasolTableMetricComputer, table_type=TableType.View)

        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback") as mock_base:
            result = computer._compute_view_metrics()

        assert result == "fallback"
        mock_base.assert_called_once_with()

    def test_compute_table_metrics_returns_none_when_no_result(self):
        session = _build_mock_session()
        session.execute.return_value.first.return_value = None
        computer = _build_computer(session, ExasolTableMetricComputer)

        result = computer._compute_table_metrics()

        assert result is None

    def test_compute_returns_result(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 3000
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, ExasolTableMetricComputer)
        result = computer.compute()
        assert result is mock_result
        assert result.rowCount == 3000

    def test_compute_returns_none_when_no_result(self):
        session = _build_mock_session()
        session.execute.return_value.first.return_value = None
        computer = _build_computer(session, ExasolTableMetricComputer)
        result = computer.compute()
        assert result is None

    def test_compute_fallback_on_none_row_count(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = None
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, ExasolTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_fallback_on_zero_row_count_for_view(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, ExasolTableMetricComputer, table_type=TableType.View)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_table_metrics_falls_back_on_none_row_count(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = None
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, ExasolTableMetricComputer)

        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback") as mock_base:
            result = computer._compute_table_metrics()

        assert result == "fallback"
        mock_base.assert_called_once_with()

    def test_compute_table_metrics_falls_back_on_zero_row_count_for_view(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, ExasolTableMetricComputer, table_type=TableType.View)

        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback") as mock_base:
            result = computer._compute_table_metrics()

        assert result == "fallback"
        mock_base.assert_called_once_with()


class TestTeradataTableMetricComputer:
    def test_teradata_registration(self):
        assert table_metric_computer_factory._constructs.get(Dialects.Teradata) is TeradataTableMetricComputer

    def test_compute_returns_result(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 7500
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, TeradataTableMetricComputer)
        result = computer.compute()
        assert result is mock_result
        assert result.rowCount == 7500

    def test_compute_returns_none_when_no_result(self):
        session = _build_mock_session()
        session.execute.return_value.first.return_value = None
        computer = _build_computer(session, TeradataTableMetricComputer)
        result = computer.compute()
        assert result is None

    def test_compute_fallback_on_none_row_count(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = None
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, TeradataTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

    def test_compute_fallback_on_zero_row_count_for_view(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result.rowCount = 0
        session.execute.return_value.first.return_value = mock_result
        computer = _build_computer(session, TeradataTableMetricComputer, table_type=TableType.View)
        with patch.object(BaseTableMetricComputer, "compute", return_value="fallback"):
            result = computer.compute()
            assert result == "fallback"

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


class TestTrinoTableMetricComputer:
    def test_show_stats_returns_row_count(self):
        session = _build_mock_session()
        summary_row = MagicMock()
        summary_row._asdict.return_value = {"column_name": None, "row_count": 891.0}
        col_row = MagicMock()
        col_row._asdict.return_value = {"column_name": "id", "row_count": None}
        session.execute.return_value = [col_row, summary_row]

        computer = _build_computer(session, TrinoTableMetricComputer)
        result = computer.compute()
        assert result.rowCount == 891

    def test_show_stats_no_row_count_falls_back(self):
        session = _build_mock_session()
        summary_row = MagicMock()
        summary_row._asdict.return_value = {"column_name": None, "row_count": None}
        session.execute.return_value = [summary_row]
        session.execute.return_value = iter([summary_row])

        computer = _build_computer(session, TrinoTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value=MagicMock(rowCount=500)):
            result = computer.compute()
        assert result.rowCount == 500

    def test_show_stats_empty_result_falls_back(self):
        session = _build_mock_session()
        session.execute.return_value = iter([])

        computer = _build_computer(session, TrinoTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value=MagicMock(rowCount=100)):
            result = computer.compute()
        assert result.rowCount == 100

    def test_result_includes_column_metadata(self):
        session = _build_mock_session()
        summary_row = MagicMock()
        summary_row._asdict.return_value = {"column_name": None, "row_count": 50.0}
        session.execute.return_value = [summary_row]

        computer = _build_computer(session, TrinoTableMetricComputer)
        result = computer.compute()
        assert result.columnCount == 2
        assert "id" in result.columnNames
        assert "name" in result.columnNames

    def test_trino_presto_athena_registrations(self):
        assert table_metric_computer_factory._constructs[Dialects.Trino] is TrinoTableMetricComputer
        assert table_metric_computer_factory._constructs[Dialects.Presto] is TrinoTableMetricComputer
        assert table_metric_computer_factory._constructs[Dialects.Athena] is TrinoTableMetricComputer


class TestHiveTableMetricComputer:
    def test_describe_formatted_extracts_numrows(self):
        session = _build_mock_session()
        rows = [
            ("", "Table Parameters:", None),
            ("", "numRows             ", "12345               "),
            ("", "rawDataSize         ", "999                 "),
        ]
        session.execute.return_value.fetchall.return_value = rows

        computer = _build_computer(session, HiveTableMetricComputer)
        result = computer.compute()
        assert result.rowCount == 12345

    def test_describe_formatted_no_match_falls_back(self):
        session = _build_mock_session()
        rows = [("col_name", "data_type", "comment")]
        session.execute.return_value.fetchall.return_value = rows

        computer = _build_computer(session, HiveTableMetricComputer)
        with patch.object(
            BaseTableMetricComputer,
            "compute",
            return_value=MagicMock(rowCount=200),
        ):
            result = computer.compute()
        assert result.rowCount == 200

    def test_hive_registration(self):
        assert table_metric_computer_factory._constructs[Dialects.Hive] is HiveTableMetricComputer


class TestImpalaTableMetricComputer:
    def test_sums_rows_across_partitions(self):
        session = _build_mock_session()
        row1 = MagicMock()
        row1._asdict.return_value = {"#Rows": "3000"}
        row2 = MagicMock()
        row2._asdict.return_value = {"#Rows": "2000"}
        session.execute.return_value.fetchall.return_value = [row1, row2]

        computer = _build_computer(session, ImpalaTableMetricComputer)
        result = computer.compute()
        assert result.rowCount == 5000

    def test_handles_lowercase_rows_key(self):
        session = _build_mock_session()
        row = MagicMock()
        row._asdict.return_value = {"#rows": "800"}
        session.execute.return_value.fetchall.return_value = [row]

        computer = _build_computer(session, ImpalaTableMetricComputer)
        result = computer.compute()
        assert result.rowCount == 800

    def test_zero_rows_falls_back(self):
        session = _build_mock_session()
        row = MagicMock()
        row._asdict.return_value = {"#Rows": "0"}
        session.execute.return_value.fetchall.return_value = [row]

        computer = _build_computer(session, ImpalaTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value=MagicMock(rowCount=0)):
            result = computer.compute()
        assert result.rowCount == 0

    def test_empty_stats_falls_back(self):
        session = _build_mock_session()
        session.execute.return_value.fetchall.return_value = []

        computer = _build_computer(session, ImpalaTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value=MagicMock(rowCount=50)):
            result = computer.compute()
        assert result.rowCount == 50

    def test_impala_registration(self):
        assert table_metric_computer_factory._constructs[Dialects.Impala] is ImpalaTableMetricComputer


class TestDatabricksTableMetricComputer:
    def test_describe_detail_returns_num_records(self):
        session = _build_mock_session()
        mock_result = MagicMock()
        mock_result._asdict.return_value = {"numRecords": 42000}
        session.execute.return_value.first.return_value = mock_result

        computer = _build_computer(session, DatabricksTableMetricComputer)
        result = computer.compute()
        assert result.rowCount == 42000

    def test_describe_detail_none_falls_back(self):
        session = _build_mock_session()
        session.execute.return_value.first.return_value = None

        computer = _build_computer(session, DatabricksTableMetricComputer)
        with patch.object(BaseTableMetricComputer, "compute", return_value=MagicMock(rowCount=5000)):
            result = computer.compute()
        assert result.rowCount == 5000

    def test_databricks_registration(self):
        assert table_metric_computer_factory._constructs[Dialects.Databricks] is DatabricksTableMetricComputer
