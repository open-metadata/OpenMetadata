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
Tests for MysqlQueryParserSource.get_sql_statement override behavior driven
by the optional `queryHistoryTable` connection field.
"""

from datetime import datetime
from types import SimpleNamespace

import pytest

from metadata.ingestion.source.database.mysql.queries import (
    MYSQL_TEST_GET_QUERIES,
    MYSQL_TEST_GET_QUERIES_SLOW_LOGS,
)
from metadata.ingestion.source.database.mysql.query_parser import (
    MysqlQueryParserSource,
)

START_TIME = datetime(2026, 1, 1, 0, 0, 0)
END_TIME = datetime(2026, 1, 2, 0, 0, 0)


def _make_stub(
    *,
    use_slow_logs: bool,
    query_history_table: str | None,
    filters: str = "",
    filter_condition: str | None = None,
    result_limit: int = 100,
) -> SimpleNamespace:
    """Build a minimal self-like stub for MysqlQueryParserSource methods."""
    stub = SimpleNamespace(
        service_connection=SimpleNamespace(
            useSlowLogs=use_slow_logs,
            queryHistoryTable=query_history_table,
        ),
        source_config=SimpleNamespace(
            resultLimit=result_limit,
            filterCondition=filter_condition,
        ),
        filters=filters,
    )
    stub.get_filters = lambda: MysqlQueryParserSource.get_filters(stub)
    return stub


class TestGetSqlStatementDefaults:
    def test_general_log_default_table(self):
        stub = _make_stub(use_slow_logs=False, query_history_table=None)
        sql = MysqlQueryParserSource.get_sql_statement(stub, START_TIME, END_TIME)

        assert "FROM mysql.general_log" in sql
        assert "mysql.slow_log" not in sql

    def test_slow_log_default_table(self):
        stub = _make_stub(use_slow_logs=True, query_history_table=None)
        sql = MysqlQueryParserSource.get_sql_statement(stub, START_TIME, END_TIME)

        assert "FROM mysql.slow_log" in sql
        assert "mysql.general_log" not in sql

    def test_empty_string_falls_back_to_default(self):
        stub = _make_stub(use_slow_logs=True, query_history_table="")
        sql = MysqlQueryParserSource.get_sql_statement(stub, START_TIME, END_TIME)

        assert "FROM mysql.slow_log" in sql


class TestGetSqlStatementCustomTable:
    def test_custom_table_overrides_general_log(self):
        stub = _make_stub(
            use_slow_logs=False,
            query_history_table="audit_db.query_log_view",
        )
        sql = MysqlQueryParserSource.get_sql_statement(stub, START_TIME, END_TIME)

        assert "FROM audit_db.query_log_view" in sql
        assert "mysql.general_log" not in sql
        assert "mysql.slow_log" not in sql

    def test_custom_table_overrides_slow_log(self):
        stub = _make_stub(
            use_slow_logs=True,
            query_history_table="audit_db.slow_log_view",
        )
        sql = MysqlQueryParserSource.get_sql_statement(stub, START_TIME, END_TIME)

        assert "FROM audit_db.slow_log_view" in sql
        assert "mysql.slow_log" not in sql
        assert "mysql.general_log" not in sql

    def test_general_log_uses_argument_column(self):
        stub = _make_stub(
            use_slow_logs=False,
            query_history_table="audit_db.query_log_view",
        )
        sql = MysqlQueryParserSource.get_sql_statement(stub, START_TIME, END_TIME)

        assert "argument `query_text`" in sql

    def test_slow_log_uses_sql_text_column(self):
        stub = _make_stub(
            use_slow_logs=True,
            query_history_table="audit_db.slow_log_view",
        )
        sql = MysqlQueryParserSource.get_sql_statement(stub, START_TIME, END_TIME)

        assert "sql_text `query_text`" in sql


@pytest.mark.parametrize(
    "use_slow_logs,expected_default",
    [
        (False, "mysql.general_log"),
        (True, "mysql.slow_log"),
    ],
)
def test_time_window_interpolated(use_slow_logs: bool, expected_default: str):
    stub = _make_stub(use_slow_logs=use_slow_logs, query_history_table=None)
    sql = MysqlQueryParserSource.get_sql_statement(stub, START_TIME, END_TIME)

    assert "2026-01-01 00:00:00" in sql
    assert "2026-01-02 00:00:00" in sql
    assert f"FROM {expected_default}" in sql


class TestTestConnectionProbeTemplates:
    """Probe queries used by MySQLConnection.test_connection must accept the
    same query_history_table substitution."""

    def test_general_log_probe_accepts_custom_table(self):
        rendered = MYSQL_TEST_GET_QUERIES.format(query_history_table="custom.tbl")
        assert "from custom.tbl" in rendered
        assert "`argument`" in rendered

    def test_slow_log_probe_accepts_custom_table(self):
        rendered = MYSQL_TEST_GET_QUERIES_SLOW_LOGS.format(query_history_table="custom.tbl")
        assert "from custom.tbl" in rendered
        assert "`sql_text`" in rendered
