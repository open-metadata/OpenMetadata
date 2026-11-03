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
"""Which Athena query history usage and lineage read, and how much of it."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from metadata.clients.aws_client import AWSClient
from metadata.ingestion.source.database.athena.lineage import AthenaLineageSource
from metadata.ingestion.source.database.athena.usage import AthenaUsageSource
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.constants import QUERY_WITH_DBT, QUERY_WITH_OM_VERSION

PAGE_SIZE = 50
IN_WINDOW = datetime.now(timezone.utc) - timedelta(minutes=5)
BEFORE_WINDOW = datetime.now(timezone.utc) - timedelta(days=5)


def _execution(execution_id, query, submitted=IN_WINDOW, state="SUCCEEDED"):
    return {
        "QueryExecutionId": execution_id,
        "Query": query,
        "Status": {"State": state, "SubmissionDateTime": submitted, "CompletionDateTime": submitted},
        "Statistics": {"TotalExecutionTimeInMillis": 10},
    }


def _user_queries(prefix, count, submitted=IN_WINDOW):
    return [_execution(f"{prefix}-{i}", f"SELECT * FROM {prefix}_{i}", submitted) for i in range(count)]


def _om_queries(count):
    return [
        _execution(f"om-{i}", f'{QUERY_WITH_OM_VERSION}, "version": "2.1"}} */ SELECT * FROM t_{i}')
        for i in range(count)
    ]


class FakeAthenaClient:
    """Stands in for the boto3 Athena client: a fixed query history per workgroup,
    newest first, served in pages of 50 like ListQueryExecutions, and the
    workgroups one per ListWorkGroups page."""

    def __init__(self, history, enabled_work_groups=(), list_work_groups_error=None):
        self._history = history
        self._executions = {e["QueryExecutionId"]: e for executions in history.values() for e in executions}
        self._enabled_work_groups = enabled_work_groups
        self._list_work_groups_error = list_work_groups_error
        self.list_work_groups_calls = 0
        self.paginated_work_groups = []
        self.pages_read = 0

    def list_work_groups(self, NextToken=None):  # noqa: N803
        self.list_work_groups_calls += 1
        if self._list_work_groups_error:
            raise self._list_work_groups_error
        work_groups = [{"Name": "disabled_workgroup", "State": "DISABLED"}] + [
            {"Name": name, "State": "ENABLED"} for name in self._enabled_work_groups
        ]
        index = int(NextToken or 0)
        response = {"WorkGroups": work_groups[index : index + 1]}
        if index + 1 < len(work_groups):
            response["NextToken"] = str(index + 1)
        return response

    def get_paginator(self, operation_name):
        assert operation_name == "list_query_executions"
        return self

    def paginate(self, **kwargs):
        work_group = kwargs.get("WorkGroup")
        self.paginated_work_groups.append(work_group)
        executions = self._history.get(work_group, [])
        for start in range(0, len(executions), PAGE_SIZE):
            self.pages_read += 1
            yield {"QueryExecutionIds": [e["QueryExecutionId"] for e in executions[start : start + PAGE_SIZE]]}

    def batch_get_query_execution(self, QueryExecutionIds):  # noqa: N803
        return {"QueryExecutions": [self._executions[execution_id] for execution_id in QueryExecutionIds]}


def _workflow_source(source_class, workgroup, result_limit):
    is_usage = source_class is AthenaUsageSource
    return {
        "type": "athena-usage" if is_usage else "athena-lineage",
        "serviceName": "athena_query_history",
        "serviceConnection": {
            "config": {
                "type": "Athena",
                "awsConfig": {"awsRegion": "us-east-1", "awsAccessKeyId": "key", "awsSecretAccessKey": "secret"},
                "s3StagingDir": "s3://bucket/staging/",
                "workgroup": workgroup,
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseUsage" if is_usage else "DatabaseLineage",
                "queryLogDuration": 1,
                "resultLimit": result_limit,
            }
        },
    }


@pytest.fixture
def build_source():
    def build(source_class, client, workgroup="workgroup_a", result_limit=1000):
        with (
            patch.object(AWSClient, "get_athena_client", return_value=client),
            patch("metadata.ingestion.source.database.query_parser_source.get_ssl_connection"),
            patch.object(QueryParserSource, "test_connection"),
        ):
            return source_class.create(_workflow_source(source_class, workgroup, result_limit), MagicMock())

    return build


def _lineage_queries(source):
    return [table_query.query for table_query in source.yield_table_query()]


def _usage_queries(source):
    return [table_query.query for batch in source.yield_table_queries() for table_query in batch.queries]


class TestWorkgroupScope:
    def test_configured_workgroup_is_the_only_history_read(self, build_source):
        client = FakeAthenaClient(
            history={"workgroup_a": _user_queries("a", 3), "workgroup_b": _user_queries("b", 3)},
            enabled_work_groups=["workgroup_a", "workgroup_b"],
        )
        source = build_source(AthenaLineageSource, client, workgroup="workgroup_a")

        assert _lineage_queries(source) == [f"SELECT * FROM a_{i}" for i in range(3)]
        assert client.paginated_work_groups == ["workgroup_a"]
        assert client.list_work_groups_calls == 0

    def test_every_enabled_workgroup_is_read_when_none_is_configured(self, build_source):
        client = FakeAthenaClient(
            history={
                "workgroup_a": _user_queries("a", 2),
                "workgroup_b": _user_queries("b", 2),
                "disabled_workgroup": _user_queries("disabled", 2),
            },
            enabled_work_groups=["workgroup_a", "workgroup_b"],
        )
        source = build_source(AthenaLineageSource, client, workgroup="")

        assert _lineage_queries(source) == [
            "SELECT * FROM a_0",
            "SELECT * FROM a_1",
            "SELECT * FROM b_0",
            "SELECT * FROM b_1",
        ]
        assert client.paginated_work_groups == ["workgroup_a", "workgroup_b"]

    def test_default_workgroup_is_read_when_workgroups_cannot_be_listed(self, build_source):
        access_denied = ClientError({"Error": {"Code": "AccessDeniedException"}}, "ListWorkGroups")
        client = FakeAthenaClient(
            history={None: _user_queries("primary", 2), "workgroup_b": _user_queries("b", 2)},
            list_work_groups_error=access_denied,
        )
        source = build_source(AthenaLineageSource, client, workgroup="")

        assert _lineage_queries(source) == ["SELECT * FROM primary_0", "SELECT * FROM primary_1"]
        assert client.paginated_work_groups == [None]


class TestResultLimit:
    def test_limit_applies_once_across_all_workgroups(self, build_source):
        client = FakeAthenaClient(
            history={"workgroup_a": _user_queries("a", 80), "workgroup_b": _user_queries("b", 80)},
            enabled_work_groups=["workgroup_a", "workgroup_b"],
        )
        source = build_source(AthenaLineageSource, client, workgroup="", result_limit=100)

        queries = _lineage_queries(source)

        assert len(queries) == 100
        assert queries[:80] == [f"SELECT * FROM a_{i}" for i in range(80)]
        assert queries[80:] == [f"SELECT * FROM b_{i}" for i in range(20)]

    def test_connector_generated_and_failed_queries_do_not_consume_the_limit(self, build_source):
        failed = [_execution(f"failed-{i}", f"SELECT * FROM f_{i}", state="FAILED") for i in range(20)]
        dbt = [_execution(f"dbt-{i}", f'{QUERY_WITH_DBT}, "node_id": "n"}} */ SELECT {i}') for i in range(20)]
        client = FakeAthenaClient(history={"workgroup_a": _om_queries(60) + failed + dbt + _user_queries("a", 40)})
        source = build_source(AthenaLineageSource, client, result_limit=40)

        assert _lineage_queries(source) == [f"SELECT * FROM a_{i}" for i in range(40)]

    def test_history_is_not_read_past_the_limit(self, build_source):
        client = FakeAthenaClient(history={"workgroup_a": _user_queries("a", 500)})
        source = build_source(AthenaLineageSource, client, result_limit=60)

        assert len(_lineage_queries(source)) == 60
        assert client.pages_read == 2


class TestQueryLogWindow:
    def test_scan_stops_once_a_page_precedes_the_window(self, build_source):
        client = FakeAthenaClient(
            history={"workgroup_a": _user_queries("recent", 50) + _user_queries("old", 150, submitted=BEFORE_WINDOW)}
        )
        source = build_source(AthenaLineageSource, client)

        assert _lineage_queries(source) == [f"SELECT * FROM recent_{i}" for i in range(50)]
        assert client.pages_read == 2


class TestUsageAndLineageContract:
    @staticmethod
    def _mixed_history():
        return {
            "workgroup_a": _om_queries(30)
            + _user_queries("a", 30)
            + [_execution("cancelled", "SELECT * FROM cancelled", state="CANCELLED")],
            "workgroup_b": _user_queries("b", 30) + _user_queries("b_old", 50, submitted=BEFORE_WINDOW),
        }

    def test_usage_and_lineage_emit_the_same_queries(self, build_source):
        work_groups = ["workgroup_a", "workgroup_b"]
        usage = build_source(
            AthenaUsageSource, FakeAthenaClient(self._mixed_history(), work_groups), workgroup="", result_limit=45
        )
        lineage = build_source(
            AthenaLineageSource, FakeAthenaClient(self._mixed_history(), work_groups), workgroup="", result_limit=45
        )

        usage_queries = _usage_queries(usage)

        assert usage_queries == _lineage_queries(lineage)
        assert usage_queries == [f"SELECT * FROM a_{i}" for i in range(30)] + [
            f"SELECT * FROM b_{i}" for i in range(15)
        ]
