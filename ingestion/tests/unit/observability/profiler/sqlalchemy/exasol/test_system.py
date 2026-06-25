"""
Test Exasol system metrics computer.
"""

from datetime import datetime
from unittest.mock import Mock

import pytest

from metadata.generated.schema.entity.data.table import DmlOperationType
from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations
from metadata.profiler.metrics.system.exasol.system import ExasolSystemMetricsComputer, get_metric_result
from metadata.profiler.processor.runner import QueryRunner


class TestExasolSystemMetricsComputer:
    """Test Exasol system metrics computer behavior."""

    @pytest.fixture
    def runner(self):
        runner = Mock(spec=QueryRunner)
        runner.schema_name = "test.schema"
        runner.table_name = "test.table"
        return runner

    @pytest.fixture
    def session(self):
        return Mock()

    @pytest.fixture
    def computer(self, session, runner):
        return ExasolSystemMetricsComputer(session=session, runner=runner)

    def test_get_queries_filters_rows_and_builds_expected_params(self, computer, session, runner):
        mock_cursor = [
            Mock(database="DEFAULT", schema="TEST.SCHEMA", table="TEST.TABLE", starttime=datetime(2024, 1, 1), rows=3),
            Mock(database="DEFAULT", schema="TEST.SCHEMA", table="OTHER.TABLE", starttime=datetime(2024, 1, 1), rows=5),
            Mock(database="DEFAULT", schema="TEST.SCHEMA", table="TEST.TABLE", starttime=datetime(2024, 1, 1), rows=0),
            Mock(
                database="DEFAULT", schema="TEST.SCHEMA", table="TEST.TABLE", starttime=datetime(2024, 1, 1), rows=None
            ),
        ]
        session.execute.return_value = mock_cursor

        result = computer._get_queries(DatabaseDMLOperations.INSERT.value)

        assert len(result) == 2
        assert result[0].database_name == "DEFAULT"
        assert result[0].schema_name == "TEST.SCHEMA"
        assert result[0].table_name == "TEST.TABLE"
        assert result[0].query_type == DatabaseDMLOperations.INSERT.value
        assert result[0].rows == 3

        executed_query, params = session.execute.call_args.args
        assert "EXASOL_SYSTEM_METRICS_QUERY" not in str(executed_query)
        assert params["database_name"] == "DEFAULT"
        assert params["schema"] == "TEST.SCHEMA"
        assert params["table"] == "TEST.TABLE"
        assert params["operation"] == DatabaseDMLOperations.INSERT.value
        assert params["table_match_pattern"] == r"(?s).*\bTEST\.SCHEMA\.TEST\.TABLE\b.*"
        assert runner.schema_name == "test.schema"
        assert runner.table_name == "test.table"

    def test_get_queries_returns_empty_when_schema_or_table_missing(self, session):
        runner = Mock(spec=QueryRunner)
        runner.schema_name = None
        runner.table_name = "table"

        computer = ExasolSystemMetricsComputer(session=session, runner=runner)

        assert computer._get_queries(DatabaseDMLOperations.UPDATE.value) == []
        session.execute.assert_not_called()

    def test_get_table_match_pattern_escapes_regex_characters(self, computer):
        pattern = computer._get_table_match_pattern("TEST.SCHEMA", "TABLE+1")

        assert pattern == r"(?s).*\bTEST\.SCHEMA\.TABLE\+1\b.*"


class TestGetMetricResult:
    """Test Exasol system metric conversion."""

    def test_get_metric_result_filters_by_table_name(self):
        ddls = [
            Mock(table_name="target_table", query_type="INSERT", start_time=datetime(2024, 1, 1), rows=7),
            Mock(table_name="other_table", query_type="DELETE", start_time=datetime(2024, 1, 1), rows=9),
        ]

        result = get_metric_result(ddls, "TARGET_TABLE")

        assert len(result) == 1
        assert result[0].operation == DmlOperationType.INSERT
        assert result[0].rowsAffected == 7
