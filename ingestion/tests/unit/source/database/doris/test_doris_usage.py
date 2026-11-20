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
Doris usage: the query log `__internal_schema.audit_log`, whose `time` Doris writes in its global time zone
"""

import re
from copy import deepcopy
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
import sqlglot
from sqlalchemy.exc import OperationalError

from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.source.database.doris.queries import DORIS_TEST_GET_QUERIES
from metadata.ingestion.source.database.doris.usage import DorisUsageSource
from metadata.utils.service_spec.service_spec import import_source_class

USAGE_SOURCE = {
    "type": "doris-usage",
    "serviceName": "local_doris",
    "serviceConnection": {"config": {"type": "Doris", "username": "om", "hostPort": "doris:9030"}},
    "sourceConfig": {"config": {"type": "DatabaseUsage", "resultLimit": 500}},
}

# The columns UsageSource.yield_table_queries reads from each row of the query log
QUERY_LOG_COLUMNS = [
    "start_time",
    "end_time",
    "duration",
    "database_name",
    "schema_name",
    "user_name",
    "aborted",
    "query_text",
]


def usage_source(**source_config) -> DorisUsageSource:
    config = deepcopy(USAGE_SOURCE)
    config["sourceConfig"]["config"].update(source_config)
    with patch("metadata.ingestion.source.database.query_parser_source.QueryParserSource.test_connection"):
        return DorisUsageSource.create(config, MagicMock())


def connected(source: DorisUsageSource, *results) -> MagicMock:
    """Give the source an engine whose connection answers its statements with `results`, in order"""
    conn = MagicMock()
    conn.execute.side_effect = results
    source.engine = MagicMock()
    source.engine.connect.return_value.__enter__.return_value = conn
    return conn


def scalar(value) -> MagicMock:
    result = MagicMock()
    result.scalar.return_value = value
    return result


def test_doris_usage_workflow_has_a_source():
    assert import_source_class(service_type=ServiceType.Database, source_type="doris-usage") is DorisUsageSource


@pytest.mark.parametrize(
    ("service_connection", "error"),
    [
        (None, "Doris service connection is required"),
        ({"config": {"type": "Mysql", "username": "om", "hostPort": "mysql:3306"}}, "Expected DorisConnection"),
    ],
)
def test_usage_source_needs_a_doris_connection(service_connection, error):
    config = deepcopy(USAGE_SOURCE)
    config["serviceConnection"] = service_connection

    with pytest.raises(InvalidSourceException, match=error):
        DorisUsageSource.create(config, MagicMock())


def test_query_log_window_is_converted_to_the_doris_time_zone():
    sql = usage_source().get_sql_statement(start_time=datetime(2026, 11, 19), end_time=datetime(2026, 11, 20))

    parsed = sqlglot.parse_one(sql, read="doris")

    assert parsed.named_selects == QUERY_LOG_COLUMNS
    assert parsed.args["limit"].expression.this == "500"
    # `time` itself stays bare, so Doris prunes the daily partitions of the log
    assert "`time` >= CONVERT_TZ('2026-11-19 00:00:00', '+00:00', @@global.time_zone)" in sql
    assert "`time` < CONVERT_TZ('2026-11-20 00:00:00', '+00:00', @@global.time_zone)" in sql
    assert "CONVERT_TZ(`time`, @@global.time_zone, '+00:00') AS start_time" in sql


@pytest.mark.parametrize(
    ("filter_condition", "filters"),
    [
        (None, "AND is_query = 1 AND is_internal = 0\n"),
        ("`user` <> 'etl'", "AND is_query = 1 AND is_internal = 0 AND (`user` <> 'etl')\n"),
    ],
)
def test_usage_reads_the_queries_users_ran(filter_condition, filters):
    source = usage_source(filterCondition=filter_condition)

    sql = source.get_sql_statement(start_time=datetime(2026, 11, 19), end_time=datetime(2026, 11, 20))

    assert f"  {filters}ORDER BY `time` DESC" in sql


def test_query_log_rows_become_table_queries():
    source = usage_source()
    source.start, source.end = datetime(2026, 11, 20), datetime(2026, 11, 21)
    row = MagicMock()
    row._asdict.return_value = dict(
        zip(
            QUERY_LOG_COLUMNS,
            [
                datetime(2026, 11, 20, 8, 45, 33, 122000),
                datetime(2026, 11, 20, 8, 45, 33, 177000),
                55,
                "internal",
                "om_verify",
                "root",
                0,
                "SELECT COUNT(*) FROM t_uniq",
            ],
            strict=True,
        )
    )
    connected(source, [row])

    queries = [query for table_queries in source.yield_table_queries() for query in table_queries.queries]

    assert len(queries) == 1
    query = queries[0]
    assert query.query == "SELECT COUNT(*) FROM t_uniq"
    # Usage resolves `internal` to the service's database, as view lineage does
    assert query.databaseName == "internal"
    assert query.databaseSchema == "om_verify"
    assert query.userName == "root"
    assert query.startTime == "2026-11-20 08:45:33.122000"
    assert query.duration == 55
    assert query.aborted is False
    assert query.dialect == Dialect.MYSQL.value


def test_unreadable_query_log_fails_with_the_grant_it_needs():
    source = usage_source()
    connected(source, OperationalError(DORIS_TEST_GET_QUERIES, {}, Exception("Permission denied")))

    with pytest.raises(InvalidSourceException, match=re.escape("SELECT_PRIV on internal.__internal_schema.audit_log")):
        source.prepare()


@pytest.mark.parametrize(("audit_enabled", "warned"), [(1, False), (0, True)])
def test_disabled_audit_logging_is_reported(audit_enabled, warned, caplog):
    source = usage_source()
    connected(source, MagicMock(), scalar(audit_enabled))

    source.prepare()

    assert ("SET GLOBAL enable_audit_plugin = true" in caplog.text) is warned


def test_query_log_file_needs_no_audit_log():
    source = usage_source(queryLogFilePath="/tmp/doris_queries.csv")
    source.engine = MagicMock()

    source.prepare()

    source.engine.connect.assert_not_called()
