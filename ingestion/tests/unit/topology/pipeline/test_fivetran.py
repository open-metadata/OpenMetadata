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
Test fivetran using the topology
"""

import json
import logging
from datetime import datetime, timezone
from fnmatch import fnmatchcase
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, unquote, urlsplit
from uuid import uuid4

import pytest

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineState,
    StatusType,
    Task,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SourceUrl
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.fivetran.client import FivetranClient
from metadata.ingestion.source.pipeline.fivetran.fivetran_log import (
    FIVETRAN_TASK_EXTRACT,
    FIVETRAN_TASK_LOAD,
    FIVETRAN_TASK_PROCESS,
    build_fallback_task_statuses,
    build_task_statuses,
    parse_sync_events,
    sort_and_limit_syncs,
)
from metadata.ingestion.source.pipeline.fivetran.metadata import FivetranSource
from metadata.ingestion.source.pipeline.fivetran.models import FivetranPipelineDetails
from metadata.utils.fqn import prefix_entity_for_wildcard_search, split

mock_file_path = Path(__file__).parent.parent.parent / "resources/datasets/fivetran_dataset.json"
with open(mock_file_path) as file:  # noqa: PTH123
    mock_data: dict = json.load(file)

MOCK_FIVETRAN_CONFIG = {
    "source": {
        "type": "fivetran",
        "serviceName": "fivetran_source",
        "serviceConnection": {
            "config": {
                "type": "Fivetran",
                "apiKey": "sample_api_key",
                "apiSecret": "sample_api_secret",
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

EXPECTED_FIVETRAN_DETAILS = FivetranPipelineDetails(
    source=mock_data.get("source"),
    destination=mock_data.get("destination"),
    group=mock_data.get("group"),
    connector_id=mock_data.get("source").get("id"),
)

SOURCE_URL = SourceUrl(
    "https://fivetran.com/dashboard/connectors/aiding_pointless/status?groupId=wackiness_remote&service=postgres_rds"
)

EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name="wackiness_remote_aiding_pointless",
    displayName="postgres_rds <> test",
    tasks=[
        Task(
            name=FIVETRAN_TASK_EXTRACT,
            displayName="Extract",
            taskType="Extract",
            downstreamTasks=[FIVETRAN_TASK_PROCESS],
            sourceUrl=SOURCE_URL,
        ),
        Task(
            name=FIVETRAN_TASK_PROCESS,
            displayName="Process",
            taskType="Process",
            downstreamTasks=[FIVETRAN_TASK_LOAD],
            sourceUrl=SOURCE_URL,
        ),
        Task(
            name=FIVETRAN_TASK_LOAD,
            displayName="Load",
            taskType="Load",
            downstreamTasks=[],
            sourceUrl=SOURCE_URL,
        ),
    ],
    service=FullyQualifiedEntityName("fivetran_source"),
    sourceUrl=SOURCE_URL,
    scheduleInterval="0 */6 * * *",
    state=PipelineState.Active,
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="fivetran_source",
    fullyQualifiedName=FullyQualifiedEntityName("fivetran_source"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Fivetran,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="wackiness_remote_aiding_pointless",
    fullyQualifiedName="fivetran_source.wackiness_remote_aiding_pointless",
    displayName="postgres_rds <> test",
    tasks=[
        Task(name=FIVETRAN_TASK_EXTRACT, displayName="Extract"),
        Task(name=FIVETRAN_TASK_PROCESS, displayName="Process"),
        Task(name=FIVETRAN_TASK_LOAD, displayName="Load"),
    ],
    service=EntityReference(id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"),
)


# -----------------------------------------------------------------------
# Pure function tests (fivetran_log.py) — no mocking needed
# -----------------------------------------------------------------------


class TestParseSyncEvents:
    def test_groups_events_by_sync_id(self):
        ts = [datetime(2026, 3, 20, 8, 0, i * 5, tzinfo=timezone.utc) for i in range(5)]
        rows = [
            ("sync-1", "sync_start", None, ts[0]),
            ("sync-1", "extract_summary", '{"status":"SUCCESS"}', ts[1]),
            ("sync-1", "write_to_table_start", None, ts[2]),
            ("sync-1", "write_to_table_end", None, ts[3]),
            ("sync-1", "sync_end", '{"status":"SUCCESSFUL"}', ts[4]),
        ]
        result = parse_sync_events(rows)
        sync = result["sync-1"]
        assert sync["sync_start_ts"] == ts[0]
        assert sync["extract_end_ts"] == ts[1]
        assert sync["extract_data"]["status"] == "SUCCESS"
        assert sync["sync_end_data"]["status"] == "SUCCESSFUL"

    def test_handles_malformed_json(self):
        rows = [("s1", "extract_summary", "not valid json", datetime.now())]
        assert "extract_data" not in parse_sync_events(rows)["s1"]

    def test_handles_empty_rows(self):
        assert parse_sync_events([]) == {}

    def test_folds_partitions_into_shared_accumulator(self):
        ts = [datetime(2026, 3, 20, 8, 0, i * 5, tzinfo=timezone.utc) for i in range(3)]
        syncs: dict = {}
        parse_sync_events([("sync-1", "sync_start", None, ts[0])], syncs)
        parse_sync_events([("sync-1", "extract_summary", '{"status":"SUCCESS"}', ts[1])], syncs)
        parse_sync_events([("sync-1", "sync_end", '{"status":"SUCCESSFUL"}', ts[2])], syncs)
        assert syncs["sync-1"]["sync_start_ts"] == ts[0]
        assert syncs["sync-1"]["extract_data"]["status"] == "SUCCESS"
        assert syncs["sync-1"]["sync_end_data"]["status"] == "SUCCESSFUL"

    def test_write_to_table_start_keeps_earliest(self):
        ts = [datetime(2026, 3, 20, 8, 0, s, tzinfo=timezone.utc) for s in (10, 5, 15)]
        rows = [("s1", "write_to_table_start", None, t) for t in ts]
        assert parse_sync_events(rows)["s1"]["write_start_min"] == ts[1]

    def test_write_to_table_end_keeps_latest(self):
        ts = [datetime(2026, 3, 20, 8, 0, s, tzinfo=timezone.utc) for s in (10, 20, 15)]
        rows = [("s1", "write_to_table_end", None, t) for t in ts]
        assert parse_sync_events(rows)["s1"]["write_end_max"] == ts[1]

    def test_ignores_unknown_events(self):
        rows = [
            ("s1", "sync_start", None, datetime(2026, 3, 20, 8, 0, 0)),
            (
                "s1",
                "unknown_event_type",
                '{"foo":"bar"}',
                datetime(2026, 3, 20, 8, 0, 5),
            ),
        ]
        sync = parse_sync_events(rows)["s1"]
        assert sync == {"sync_start_ts": datetime(2026, 3, 20, 8, 0, 0)}

    def test_sync_stats_malformed_json_is_skipped(self):
        rows = [("s1", "sync_stats", "not json", datetime(2026, 3, 20, 8, 0, 0))]
        assert "sync_stats" not in parse_sync_events(rows)["s1"]

    def test_sync_end_malformed_json_still_records_timestamp(self):
        ts = datetime(2026, 3, 20, 8, 0, 0, tzinfo=timezone.utc)
        rows = [("s1", "sync_end", "not json", ts)]
        sync = parse_sync_events(rows)["s1"]
        assert sync["sync_end_ts"] == ts
        assert "sync_end_data" not in sync

    def test_groups_events_across_multiple_sync_ids(self):
        ts = datetime(2026, 3, 20, 8, 0, 0, tzinfo=timezone.utc)
        rows = [
            ("s1", "sync_start", None, ts),
            ("s2", "sync_start", None, ts),
        ]
        result = parse_sync_events(rows)
        assert set(result.keys()) == {"s1", "s2"}


class TestBuildTaskStatuses:
    def test_successful_sync(self):
        sync = {
            "sync_start_ts": datetime(2026, 3, 20, 8, 0, 0),
            "extract_end_ts": datetime(2026, 3, 20, 8, 0, 10),
            "extract_data": {"status": "SUCCESS"},
            "write_start_min": datetime(2026, 3, 20, 8, 0, 16),
            "write_end_max": datetime(2026, 3, 20, 8, 0, 21),
            "sync_end_ts": datetime(2026, 3, 20, 8, 0, 22),
            "sync_end_data": {"status": "SUCCESSFUL"},
        }
        tasks = build_task_statuses(sync)
        assert len(tasks) == 3
        assert all(t.executionStatus == StatusType.Successful for t in tasks)

    def test_failed_extract_cascades(self):
        sync = {
            "sync_start_ts": datetime(2026, 3, 20, 8, 0, 0),
            "extract_end_ts": datetime(2026, 3, 20, 8, 0, 10),
            "extract_data": {"status": "FAILURE"},
            "sync_end_ts": datetime(2026, 3, 20, 8, 0, 11),
            "sync_end_data": {"status": "FAILURE_WITH_TASK"},
        }
        tasks = build_task_statuses(sync)
        assert all(t.executionStatus == StatusType.Failed for t in tasks)

    def test_sync_stats_fallback_fills_timestamps(self):
        sync = {
            "sync_start_ts": datetime(2026, 3, 20, 8, 0, 0),
            "sync_end_ts": datetime(2026, 3, 20, 8, 0, 27),
            "sync_end_data": {"status": "SUCCESSFUL"},
            "sync_stats": {
                "extract_time_s": 10,
                "process_time_s": 6,
                "load_time_s": 5,
            },
        }
        tasks = build_task_statuses(sync)
        assert tasks[0].endTime is not None
        assert all(t.executionStatus == StatusType.Successful for t in tasks)


class TestBuildFallbackTaskStatuses:
    def test_creates_three_tasks(self):
        tasks = build_fallback_task_statuses(StatusType.Successful, 1000, 2000)
        assert len(tasks) == 3
        assert {t.name for t in tasks} == {
            FIVETRAN_TASK_EXTRACT,
            FIVETRAN_TASK_PROCESS,
            FIVETRAN_TASK_LOAD,
        }


class TestSortAndLimitSyncs:
    def test_sorts_descending(self):
        syncs = {
            "s1": {"sync_start_ts": datetime(2026, 1, 1, tzinfo=timezone.utc)},
            "s2": {"sync_start_ts": datetime(2026, 3, 1, tzinfo=timezone.utc)},
        }
        result = sort_and_limit_syncs(syncs)
        assert result[0]["sync_start_ts"].month == 3

    def test_skips_missing_start(self):
        syncs = {
            "s1": {"sync_start_ts": datetime(2026, 1, 1, tzinfo=timezone.utc)},
            "s2": {"extract_end_ts": datetime(2026, 3, 1, tzinfo=timezone.utc)},
        }
        assert len(sort_and_limit_syncs(syncs)) == 1


# -----------------------------------------------------------------------
# Pytest fixture replacing TestCase.__init__
# -----------------------------------------------------------------------


@pytest.fixture()
def fivetran_source():
    with (
        patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"),
        patch("metadata.ingestion.source.pipeline.fivetran.connection.FivetranConnection._get_client") as mock_client,
    ):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_FIVETRAN_CONFIG)
        source = FivetranSource.create(
            MOCK_FIVETRAN_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        source.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        source.context.get().__dict__["pipeline_service"] = MOCK_PIPELINE_SERVICE.name.root

        client = mock_client.return_value
        client.list_groups.return_value = [mock_data["group"]]
        client.list_group_connectors.return_value = [mock_data["source"]]
        client.get_destination_details.return_value = mock_data["destination"]
        client.get_connector_details.return_value = mock_data["source"]

        yield source, client


# -----------------------------------------------------------------------
# Topology tests (pytest style)
# -----------------------------------------------------------------------


class TestFivetranSource:
    def test_pipeline_list(self, fivetran_source):
        source, _ = fivetran_source
        assert list(source.get_pipelines_list())[0] == EXPECTED_FIVETRAN_DETAILS  # noqa: RUF015

    def test_pipeline_list_skips_a_group_whose_connectors_cannot_be_listed(self, fivetran_source):
        """A failed listing skips that group instead of aborting every later one."""
        source, client = fivetran_source
        client.list_groups.return_value = [{"id": "unreachable"}, mock_data["group"]]
        client.list_group_connectors.side_effect = [
            RuntimeError("Fivetran API request failed"),
            [mock_data["source"]],
        ]

        assert list(source.get_pipelines_list()) == [EXPECTED_FIVETRAN_DETAILS]

    def test_pipeline_list_carries_the_platform_connection_schema(self, fivetran_source):
        source, client = fivetran_source
        client.list_group_connectors.return_value = [
            mock_data["source"],
            {"id": "untruth_abrogation", "service": "fivetran_log", "schema": "acme_ops_audit_logs"},
        ]

        details = list(source.get_pipelines_list())

        assert len(details) == 2
        assert {detail.log_schema for detail in details} == {"acme_ops_audit_logs"}

    def test_pipeline_list_prefers_the_configured_log_schema(self, fivetran_source):
        source, client = fivetran_source
        client.list_group_connectors.return_value = [
            mock_data["source"],
            {"id": "untruth_abrogation", "service": "fivetran_log", "schema": "acme_ops_audit_logs"},
        ]
        source.service_connection = FivetranConnection.model_validate(
            {
                **MOCK_FIVETRAN_CONFIG["source"]["serviceConnection"]["config"],
                "logSchema": "my_own_schema",
            }
        )

        details = list(source.get_pipelines_list())

        assert {detail.log_schema for detail in details} == {"my_own_schema"}

    def test_pipeline_name(self, fivetran_source):
        source, _ = fivetran_source
        expected = f"{mock_data['source']['schema']} <> {mock_data['group']['name']}"
        assert source.get_pipeline_name(EXPECTED_FIVETRAN_DETAILS) == expected

    def test_pipelines(self, fivetran_source):
        source, _ = fivetran_source
        pipeline = list(source.yield_pipeline(EXPECTED_FIVETRAN_DETAILS))[0].right  # noqa: RUF015
        assert pipeline == EXPECTED_CREATED_PIPELINES

    def test_pipeline_has_three_elt_tasks(self, fivetran_source):
        source, _ = fivetran_source
        pipeline = list(source.yield_pipeline(EXPECTED_FIVETRAN_DETAILS))[0].right  # noqa: RUF015
        assert len(pipeline.tasks) == 3
        assert pipeline.tasks[0].name == FIVETRAN_TASK_EXTRACT
        assert pipeline.tasks[2].name == FIVETRAN_TASK_LOAD

    def test_schedule_interval(self, fivetran_source):
        assert FivetranSource._get_schedule_interval(EXPECTED_FIVETRAN_DETAILS) == "0 */6 * * *"

    def test_pipeline_state_active(self, fivetran_source):
        assert FivetranSource._get_pipeline_state(EXPECTED_FIVETRAN_DETAILS) == PipelineState.Active

    def test_pipeline_state_inactive(self, fivetran_source):
        details = FivetranPipelineDetails(
            source={"paused": True, "schema": "t", "service": "pg"},
            destination=mock_data["destination"],
            group=mock_data["group"],
            connector_id="t",
        )
        assert FivetranSource._get_pipeline_state(details) == PipelineState.Inactive


class TestGetScheduleInterval:
    @pytest.mark.parametrize(
        "sync_freq,expected",
        [
            (None, None),
            ("", None),
            ("abc", None),
            ("0", None),
            ("-5", None),
            ("5", "*/5 * * * *"),
            ("15", "*/15 * * * *"),
            ("30", "*/30 * * * *"),
            ("59", "*/59 * * * *"),
            ("60", "0 */1 * * *"),
            ("90", None),
            ("120", "0 */2 * * *"),
            ("150", None),
            ("360", "0 */6 * * *"),
            ("1440", "0 0 * * *"),
            ("2880", "0 0 * * *"),
        ],
        ids=[
            "none",
            "empty",
            "non-numeric",
            "zero",
            "negative",
            "5min",
            "15min",
            "30min",
            "59min",
            "1hour",
            "90min-not-divisible",
            "2hours",
            "150min-not-divisible",
            "6hours",
            "24hours-daily",
            "48hours-capped-daily",
        ],
    )
    def test_schedule_interval(self, sync_freq, expected):
        details = FivetranPipelineDetails(
            source={"sync_frequency": sync_freq, "schema": "t", "service": "pg"},
            destination={},
            group={},
            connector_id="t",
        )
        assert FivetranSource._get_schedule_interval(details) == expected


class TestGetDataErrorHandling:
    def test_raises_on_none_response(self, fivetran_source):
        source, client = fivetran_source  # noqa: RUF059
        ft_client = FivetranClient.__new__(FivetranClient)
        ft_client.config = Mock(limit=100)
        ft_client.client = Mock()
        ft_client.client.get.return_value = None
        with pytest.raises(RuntimeError, match="received None response"):
            ft_client._get_data("/test/path")

    def test_returns_empty_on_non_dict_response(self, fivetran_source):
        ft_client = FivetranClient.__new__(FivetranClient)
        ft_client.config = Mock(limit=100)
        ft_client.client = Mock()
        ft_client.client.get.return_value = "not a dict"
        assert ft_client._get_data("/test/path") == {}

    def test_returns_empty_on_missing_data_field(self, fivetran_source):
        ft_client = FivetranClient.__new__(FivetranClient)
        ft_client.config = Mock(limit=100)
        ft_client.client = Mock()
        ft_client.client.get.return_value = {"status": "ok"}
        assert ft_client._get_data("/test/path") == {}

    def test_returns_empty_on_non_dict_data_field(self, fivetran_source):
        ft_client = FivetranClient.__new__(FivetranClient)
        ft_client.config = Mock(limit=100)
        ft_client.client = Mock()
        ft_client.client.get.return_value = {"data": ["list", "not", "dict"]}
        assert ft_client._get_data("/test/path") == {}

    def test_returns_data_on_valid_response(self, fivetran_source):
        ft_client = FivetranClient.__new__(FivetranClient)
        ft_client.config = Mock(limit=100)
        ft_client.client = Mock()
        ft_client.client.get.return_value = {"data": {"id": "123", "name": "test"}}
        result = ft_client._get_data("/test/path")
        assert result == {"id": "123", "name": "test"}


class TestFivetranStatus:
    def test_status_from_sync_history(self, fivetran_source):
        source, client = fivetran_source
        client.get_connector_sync_history.return_value = [
            {
                "start": "2026-03-20T08:18:56.823Z",
                "end": "2026-03-20T08:19:12.094Z",
                "status": "COMPLETED",
            },
            {
                "start": "2026-03-19T08:00:00.000Z",
                "end": "2026-03-19T08:01:30.000Z",
                "status": "FAILURE_WITH_TASK",
            },
        ]
        statuses = list(source.yield_pipeline_status(EXPECTED_FIVETRAN_DETAILS))
        assert len(statuses) >= 2
        assert statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        assert statuses[1].right.pipeline_status.executionStatus == StatusType.Failed

    def test_status_falls_back_to_historical(self, fivetran_source):
        source, client = fivetran_source
        client.get_connector_sync_history.return_value = []
        statuses = list(source.yield_pipeline_status(EXPECTED_FIVETRAN_DETAILS))
        assert len(statuses) >= 1

    def test_status_deduplicates(self, fivetran_source):
        source, client = fivetran_source
        client.get_connector_sync_history.return_value = [
            {
                "start": "2022-07-25T08:34:31.425131Z",
                "end": "2022-07-25T08:35:00.000Z",
                "status": "COMPLETED",
            },
        ]
        statuses = list(source.yield_pipeline_status(EXPECTED_FIVETRAN_DETAILS))
        timestamps = [s.right.pipeline_status.timestamp.root for s in statuses]
        assert len(timestamps) == len(set(timestamps))

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.query_sync_logs")
    def test_status_from_db(self, mock_query_logs, fivetran_source):
        source, _ = fivetran_source
        mock_query_logs.return_value = parse_sync_events(
            [
                ("sync-1", "sync_start", None, datetime(2026, 3, 20, 8, 0, 0)),
                (
                    "sync-1",
                    "extract_summary",
                    '{"status":"SUCCESS"}',
                    datetime(2026, 3, 20, 8, 0, 10),
                ),
                (
                    "sync-1",
                    "sync_end",
                    '{"status":"SUCCESSFUL"}',
                    datetime(2026, 3, 20, 8, 0, 22),
                ),
            ]
        )
        source._resolve_log_source = Mock(return_value=Mock())
        statuses = list(source.yield_pipeline_status(EXPECTED_FIVETRAN_DETAILS))
        assert len(statuses) == 1
        assert statuses[0].right.pipeline_status.executionStatus == StatusType.Successful

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.query_sync_logs")
    def test_status_db_failure_falls_back(self, mock_query_logs, fivetran_source):
        source, client = fivetran_source
        mock_query_logs.return_value = None
        source._resolve_log_source = Mock(return_value=Mock())
        client.get_connector_sync_history.return_value = [
            {
                "start": "2026-03-20T08:18:56.823Z",
                "end": "2026-03-20T08:19:12.094Z",
                "status": "COMPLETED",
            },
        ]
        statuses = list(source.yield_pipeline_status(EXPECTED_FIVETRAN_DETAILS))
        assert statuses[0].right.pipeline_status.executionStatus == StatusType.Successful


class FivetranMetadataTransport:
    def __init__(self):
        self.entities = {model_str(MOCK_PIPELINE.fullyQualifiedName): MOCK_PIPELINE}
        self.hits = None
        self.total = None
        self.relation = "eq"
        self.partial = {}
        self.errors = {}
        self.requests = []
        self.closed = False

    def get(self, path):
        parsed = urlsplit(path)
        name = unquote(parsed.path)
        params = parse_qs(parsed.query)
        self.requests.append((name, params))
        if error := self.errors.get(name):
            raise error
        if name == "/search/query":
            return {"hits": {"hits": [], "total": {"value": 0, "relation": "eq"}}}
        if name == "/search/fieldQuery":
            hits = self.hits
            if hits is None:
                query = params["fieldValue"][0].casefold()
                hits = [
                    key
                    for key, value in self.entities.items()
                    if isinstance(value, Table) and fnmatchcase(key.casefold(), query)
                ]
            return {
                "hits": {
                    "total": {"value": len(hits) if self.total is None else self.total, "relation": self.relation},
                    "hits": [{"_source": {"fullyQualifiedName": key}} for key in hits],
                },
                **self.partial,
            }
        entity = self.entities.get(name.split("/name/", 1)[1])
        if entity is None:
            raise APIError({"code": 404, "message": "not found"})
        return entity.model_dump(mode="json")

    def close(self):
        self.closed = True


def lineage_table(name, **kwargs):
    return Table(
        id=uuid4(),
        name=split(name)[-1],
        fullyQualifiedName=name,
        columns=[{"name": "id", "dataType": "INT", "fullyQualifiedName": name + ".id"}],
        **kwargs,
    )


@pytest.fixture
def lineage_boundary(fivetran_source):
    source, client = fivetran_source
    config = OpenMetadataWorkflowConfig.model_validate(MOCK_FIVETRAN_CONFIG)
    source.metadata = OpenMetadata(config.workflowConfig.openMetadataServerConfig)
    transport = FivetranMetadataTransport()
    source.metadata.client = transport
    source.source_config = type(source.source_config).model_validate(
        {"type": "PipelineMetadata", "lineageInformation": {"dbServiceNames": ["A", "B", "warehouse"]}}
    )
    client.get_connector_schema_details.return_value = {
        "public": {
            "enabled": True,
            "name_in_destination": "landing",
            "tables": {"orders": {"enabled": True, "name_in_destination": "orders_copy"}},
        }
    }
    client.get_connector_column_lineage.return_value = {"id": {"enabled": True, "name_in_destination": "id"}}
    details = FivetranPipelineDetails(
        source={"id": "orders_connector", "service": "postgres", "schema": "public", "config": {"database": "db"}},
        destination={"id": "destination", "service": "snowflake", "config": {"database": "analytics"}},
        group={"id": "group", "name": "group"},
        connector_id="orders_connector",
    )
    return source, client, transport, details


class TestFivetranUniqueTableLineage:
    @pytest.mark.parametrize("services", [["A", "B", "warehouse"], ["B", "A", "warehouse"]])
    def test_ambiguous_source_warns_and_emits_no_edge(self, lineage_boundary, services, caplog):
        source, client, transport, details = lineage_boundary
        source.source_config.lineageInformation.dbServiceNames = services
        tables = [
            lineage_table(name)
            for name in ("A.db.public.orders", "B.db.public.orders", "warehouse.analytics.landing.orders_copy")
        ]
        transport.entities.update({model_str(table.fullyQualifiedName): table for table in tables})

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "ambiguous" in caplog.text
        assert "source" in caplog.text
        assert "public <> group" in caplog.text
        assert "A.db.public.orders" in caplog.text
        assert "B.db.public.orders" in caplog.text
        assert client.get_connector_column_lineage.call_count == 0

    def test_unique_later_service_preserves_table_and_column_ids(self, lineage_boundary):
        source, _, transport, details = lineage_boundary
        upstream = lineage_table("B.db.public.orders")
        downstream = lineage_table("warehouse.analytics.landing.orders_copy")
        transport.entities.update({model_str(table.fullyQualifiedName): table for table in (upstream, downstream)})

        result = list(source.yield_pipeline_lineage_details(details))

        assert len(result) == 1
        edge = result[0].right.edge
        assert edge.fromEntity.id == upstream.id
        assert edge.toEntity.id == downstream.id
        assert edge.lineageDetails.columnsLineage == [
            ColumnLineage(fromColumns=["B.db.public.orders.id"], toColumn="warehouse.analytics.landing.orders_copy.id")
        ]

    def test_ambiguous_destination_warns_without_fetching_columns(self, lineage_boundary, caplog):
        source, client, transport, details = lineage_boundary
        tables = [
            lineage_table(name)
            for name in (
                "A.db.public.orders",
                "B.analytics.landing.orders_copy",
                "warehouse.analytics.landing.orders_copy",
            )
        ]
        transport.entities.update({model_str(table.fullyQualifiedName): table for table in tables})

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "destination" in caplog.text
        assert "ambiguous" in caplog.text
        assert "B.analytics.landing.orders_copy" in caplog.text
        assert "warehouse.analytics.landing.orders_copy" in caplog.text
        assert client.get_connector_column_lineage.call_count == 0

    def test_ambiguity_remains_visible_when_another_edge_is_unique(self, lineage_boundary, caplog):
        source, client, transport, details = lineage_boundary
        client.get_connector_schema_details.return_value["public"]["tables"]["customers"] = {
            "enabled": True,
            "name_in_destination": "customers_copy",
        }
        tables = [
            lineage_table(name)
            for name in (
                "A.db.public.orders",
                "B.db.public.orders",
                "A.db.public.customers",
                "warehouse.analytics.landing.orders_copy",
                "warehouse.analytics.landing.customers_copy",
            )
        ]
        transport.entities.update({model_str(table.fullyQualifiedName): table for table in tables})

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert len(result) == 1
        assert result[0].right.edge.fromEntity.id == tables[2].id
        assert result[0].right.edge.toEntity.id == tables[4].id
        assert "ambiguous" in caplog.text
        assert "A.db.public.orders" in caplog.text
        assert "produced no lineage" not in caplog.text

    @pytest.mark.parametrize("status", [403, 503])
    def test_lookup_failed_after_a_match_does_not_prove_uniqueness(self, lineage_boundary, caplog, status):
        source, client, transport, details = lineage_boundary
        upstream = lineage_table("A.db.public.orders")
        transport.entities[model_str(upstream.fullyQualifiedName)] = upstream
        transport.errors["/tables/name/B.db.public.orders"] = APIError(
            {"code": status, "message": "secret-host:secret-password"}
        )

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "lookup failed" in caplog.text
        assert "source" in caplog.text
        assert "secret-host" not in caplog.text
        assert "secret-password" not in caplog.text
        assert client.get_connector_column_lineage.call_count == 0
        assert not transport.closed

    @pytest.mark.parametrize("services", [[], ["A"], ["A", "A"]])
    def test_unique_resolution_deduplicates_services_and_hits(self, lineage_boundary, services):
        source, _, transport, _ = lineage_boundary
        source.source_config.lineageInformation.dbServiceNames = services
        entity = lineage_table("A.db.public.orders")
        transport.entities[model_str(entity.fullyQualifiedName)] = entity
        transport.hits = [model_str(entity.fullyQualifiedName)] * 2

        result = source._resolve_table(table_name="orders", schema_name="public", database_name="db")

        assert result.entity == entity
        assert result.reason is None
        assert not transport.closed

    @pytest.mark.parametrize("services", [[], ["A"]])
    def test_ambiguous_partial_name_checks_every_database(self, lineage_boundary, services):
        source, _, transport, _ = lineage_boundary
        source.source_config.lineageInformation.dbServiceNames = services
        tables = [lineage_table(name) for name in ("A.db.public.orders", "A.another.public.orders")]
        transport.entities.update({model_str(table.fullyQualifiedName): table for table in tables})

        result = source._resolve_table(table_name="orders", schema_name="public", database_name=None)

        assert result.entity is None
        assert result.reason == "ambiguous"
        assert set(result.candidates) == {model_str(table.fullyQualifiedName) for table in tables}

    def test_configured_miss_never_widens_to_another_service(self, lineage_boundary):
        source, _, transport, _ = lineage_boundary
        source.source_config.lineageInformation.dbServiceNames = ["A"]
        entity = lineage_table("B.db.public.orders")
        transport.entities[model_str(entity.fullyQualifiedName)] = entity

        result = source._resolve_table(table_name="orders", schema_name="public", database_name="db")

        assert result.entity is None
        assert result.reason == "not_found"

    @pytest.mark.parametrize(
        "database,schema,expected",
        [
            (None, "public", "A.*.public.orders"),
            ("db", None, "A.db.*.orders"),
            (None, None, "A.*.*.orders"),
        ],
    )
    def test_unique_missing_parent_slots_stay_in_place(self, lineage_boundary, database, schema, expected):
        source, _, transport, _ = lineage_boundary
        source.source_config.lineageInformation.dbServiceNames = ["A"]
        entity = lineage_table("A.db.public.orders")
        transport.entities[model_str(entity.fullyQualifiedName)] = entity

        result = source._resolve_table(table_name="orders", schema_name=schema, database_name=database)

        assert result.entity == entity
        assert transport.requests[0][1]["fieldValue"] == [expected]

    @pytest.mark.parametrize(
        "field,value",
        [
            ("partial", {"timed_out": True}),
            ("partial", {"_shards": {"failed": 1}}),
            ("total", 2),
            ("relation", "gte"),
            ("total", 11),
        ],
    )
    def test_incomplete_lookup_is_not_a_unique_match(self, lineage_boundary, field, value):
        source, _, transport, _ = lineage_boundary
        source.source_config.lineageInformation.dbServiceNames = ["A"]
        entity = lineage_table("A.db.public.orders")
        transport.entities[model_str(entity.fullyQualifiedName)] = entity
        setattr(transport, field, value)

        result = source._resolve_table(table_name="orders", schema_name="public", database_name=None)

        assert result.entity is None
        assert result.reason == "lookup_failed"
        assert not transport.closed

    @pytest.mark.parametrize("table_name", [None, ""])
    def test_missing_leaf_has_no_fabricated_lookup(self, lineage_boundary, table_name):
        source, _, transport, _ = lineage_boundary

        result = source._resolve_table(table_name=table_name, schema_name="public", database_name="db")

        assert result.entity is None
        assert result.reason == "not_found"
        assert transport.requests == []

    def test_second_run_can_resolve_a_previously_ambiguous_table(self, lineage_boundary):
        source, _, transport, _ = lineage_boundary
        tables = [lineage_table(name) for name in ("A.db.public.orders", "B.db.public.orders")]
        transport.entities.update({model_str(table.fullyQualifiedName): table for table in tables})
        first = source._resolve_table(table_name="orders", schema_name="public", database_name="db")
        assert first.reason == "ambiguous"
        del transport.entities["B.db.public.orders"]

        second = source._resolve_table(table_name="orders", schema_name="public", database_name="db")

        assert second.entity == tables[0]
        assert second.reason is None

    @pytest.mark.parametrize(
        "name,fqn_name,search",
        [
            ("orders.2026", 'A.db.public."orders.2026"', 'A.*.public."orders.2026"'),
            ('"orders.2026"', 'A.db.public."orders.2026"', 'A.*.public."orders.2026"'),
            ("order rows", "A.db.public.order rows", "A.*.public.order rows"),
            ("고객", "A.db.public.고객", "A.*.public.고객"),
            ("orders*", "A.db.public.orders*", r"A.*.public.orders\*"),
            ("orders?", "A.db.public.orders?", r"A.*.public.orders\?"),
        ],
    )
    def test_unique_literal_name_is_not_reparsed_or_expanded(self, lineage_boundary, name, fqn_name, search):
        source, _, transport, _ = lineage_boundary
        source.source_config.lineageInformation.dbServiceNames = ["A"]
        entity = lineage_table(fqn_name)
        transport.entities[fqn_name] = entity
        transport.hits = [fqn_name, "A.db.public.orders_other"]

        result = source._resolve_table(table_name=name, schema_name="public", database_name=None)

        assert result.entity == entity
        assert transport.requests[0][1]["fieldValue"] == [search]

    def test_exact_first_policy_does_not_give_a_service_precedence(self, lineage_boundary):
        source, _, transport, _ = lineage_boundary
        tables = [lineage_table(name) for name in ("A.db.public.orders", "B.DB.PUBLIC.ORDERS")]
        transport.entities.update({model_str(table.fullyQualifiedName): table for table in tables})

        result = source._resolve_table(table_name="orders", schema_name="public", database_name="db")

        assert result.reason == "ambiguous"
        assert result.entity is None

    @pytest.mark.parametrize("state", ["deleted", "stale", "identity_mismatch"])
    def test_stale_or_deleted_search_hits_cannot_supply_an_entity(self, lineage_boundary, state):
        source, _, transport, _ = lineage_boundary
        source.source_config.lineageInformation.dbServiceNames = ["A"]
        transport.hits = ["A.db.public.orders"]
        if state != "stale":
            transport.entities["A.db.public.orders"] = lineage_table(
                "A.db.public.other" if state == "identity_mismatch" else "A.db.public.orders",
                deleted=state == "deleted",
            )

        result = source._resolve_table(table_name="orders", schema_name="public", database_name=None)

        assert result.entity is None
        assert result.reason == "not_found"

    def test_self_referencing_edge_is_still_rejected(self, lineage_boundary, caplog):
        source, _, transport, details = lineage_boundary
        upstream = lineage_table("A.db.public.orders")
        downstream = lineage_table("warehouse.analytics.landing.orders_copy").model_copy(update={"id": upstream.id})
        transport.entities.update({model_str(table.fullyQualifiedName): table for table in (upstream, downstream)})

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "self-referencing edge" in caplog.text


@pytest.fixture
def unique_lineage_boundary(lineage_boundary):
    source, client, transport, details = lineage_boundary
    for name in ("A.db.public.orders", "warehouse.analytics.landing.orders_copy"):
        transport.entities[name] = lineage_table(name)
    return source, client, transport, details


class TestFivetranLineage:
    @pytest.mark.parametrize("configured", [None, []])
    def test_unique_unconfigured_generator_fallback(self, unique_lineage_boundary, configured):
        source, _, transport, details = unique_lineage_boundary
        if configured is None:
            source.source_config.lineageInformation = None
        else:
            source.source_config.lineageInformation.dbServiceNames = configured

        result = list(source.yield_pipeline_lineage_details(details))

        assert len(result) == 1
        assert result[0].right.edge.fromEntity.id == transport.entities["A.db.public.orders"].id
        assert result[0].right.edge.toEntity.id == transport.entities["warehouse.analytics.landing.orders_copy"].id

    def test_closing_generator_keeps_borrowed_metadata_usable(self, unique_lineage_boundary):
        source, _, transport, details = unique_lineage_boundary
        generator = source.yield_pipeline_lineage_details(details)
        result = next(generator)

        generator.close()

        assert result.right.edge.fromEntity.id == transport.entities["A.db.public.orders"].id
        assert (
            source.metadata.get_by_name(entity=Table, fqn="A.db.public.orders")
            == transport.entities["A.db.public.orders"]
        )
        assert not transport.closed

    @pytest.mark.parametrize("disabled", ["schema", "table"])
    def test_skips_disabled_without_warning(self, lineage_boundary, caplog, disabled):
        source, client, _, details = lineage_boundary
        schema = client.get_connector_schema_details.return_value["public"]
        if disabled == "schema":
            schema["enabled"] = False
        else:
            schema["tables"]["orders"]["enabled"] = False

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "produced no lineage" not in caplog.text

    def test_warns_when_lineage_enabled_but_no_edges(self, lineage_boundary, caplog):
        source, _, _, details = lineage_boundary

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "produced no lineage" in caplog.text
        assert "source entity not found" in caplog.text

    def test_warning_names_actionable_reason_over_disabled(self, lineage_boundary, caplog):
        source, client, _, details = lineage_boundary
        client.get_connector_schema_details.return_value.update(
            {"disabled_one": {"enabled": False}, "disabled_two": {"enabled": False}}
        )

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "source entity not found" in caplog.text
        assert "schema disabled in Fivetran" not in caplog.text

    def test_no_warning_when_edges_produced_despite_disables(self, unique_lineage_boundary, caplog):
        source, client, _, details = unique_lineage_boundary
        client.get_connector_schema_details.return_value["disabled"] = {"enabled": False}

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert len(result) == 1
        assert not caplog.records

    def test_missing_destination_is_reported(self, lineage_boundary, caplog):
        source, _, transport, details = lineage_boundary
        transport.entities["A.db.public.orders"] = lineage_table("A.db.public.orders")

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "destination entity not found" in caplog.text

    @pytest.mark.parametrize("destination_name", [None, ""])
    def test_missing_destination_name_does_not_search_for_a_fabricated_leaf(
        self, unique_lineage_boundary, destination_name, caplog
    ):
        source, client, transport, details = unique_lineage_boundary
        client.get_connector_schema_details.return_value["public"]["tables"]["orders"]["name_in_destination"] = (
            destination_name
        )

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "destination entity not found" in caplog.text
        assert all("None" not in path for path, _ in transport.requests)
        assert client.get_connector_column_lineage.call_count == 0

    def test_column_api_failure_still_emits_entity_edge(self, unique_lineage_boundary, caplog):
        source, client, _, details = unique_lineage_boundary
        client.get_connector_column_lineage.side_effect = RuntimeError("Column endpoint unavailable")

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert len(result) == 1
        assert result[0].right.edge.lineageDetails.columnsLineage is None
        assert "Column lineage skipped" in caplog.text

    def test_entity_edge_survives_unresolvable_column(self, unique_lineage_boundary):
        source, client, _, details = unique_lineage_boundary
        client.get_connector_column_lineage.return_value = {
            "unknown": {"enabled": True, "name_in_destination": "unknown"}
        }

        result = list(source.yield_pipeline_lineage_details(details))

        assert len(result) == 1
        assert result[0].right.edge.lineageDetails.columnsLineage is None

    def test_missing_pipeline_still_skips_lineage(self, unique_lineage_boundary, caplog):
        source, _, transport, details = unique_lineage_boundary
        del transport.entities[model_str(MOCK_PIPELINE.fullyQualifiedName)]

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert result == []
        assert "Pipeline entity not found" in caplog.text

    @pytest.mark.parametrize("messaging_source", [True, False])
    @pytest.mark.parametrize("column_failure", [False, True])
    def test_messaging_and_table_lineage_keeps_unique_table_endpoint(
        self, unique_lineage_boundary, messaging_source, column_failure, caplog
    ):
        source, client, transport, details = unique_lineage_boundary
        source.source_config.lineageInformation.messagingServiceNames = ["kafka"]
        topic_name = "orders" if messaging_source else "landing.orders_copy"
        topic_fqn = "kafka.orders" if messaging_source else 'kafka."landing.orders_copy"'
        topic = Topic(
            id=uuid4(),
            name=topic_name,
            fullyQualifiedName=topic_fqn,
            service=EntityReference(id=uuid4(), type="messagingService", name="kafka"),
            partitions=1,
            messageSchema={
                "schemaFields": [{"name": "id", "dataType": "INT", "fullyQualifiedName": topic_fqn + ".id"}]
            },
        )
        transport.entities[topic_fqn] = topic
        endpoint = details.source if messaging_source else details.destination
        endpoint["service"] = "kafka"
        if column_failure:
            client.get_connector_column_lineage.side_effect = RuntimeError("Column endpoint unavailable")

        with caplog.at_level(logging.WARNING):
            result = list(source.yield_pipeline_lineage_details(details))

        assert len(result) == 1
        edge = result[0].right.edge
        upstream = topic if messaging_source else transport.entities["A.db.public.orders"]
        downstream = transport.entities["warehouse.analytics.landing.orders_copy"] if messaging_source else topic
        assert edge.fromEntity.id == upstream.id
        assert edge.toEntity.id == downstream.id
        assert edge.fromEntity.type == ("topic" if messaging_source else "table")
        assert edge.toEntity.type == ("table" if messaging_source else "topic")
        if column_failure:
            assert edge.lineageDetails.columnsLineage is None
            assert "Column lineage skipped" in caplog.text
        else:
            assert edge.lineageDetails.columnsLineage == [
                ColumnLineage(
                    fromColumns=[model_str(upstream.fullyQualifiedName) + ".id"],
                    toColumn=model_str(downstream.fullyQualifiedName) + ".id",
                )
            ]

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_messaging_service_names")
    def test_topic_search_string_quotes_dotted_name(self, mock_get_services, fivetran_source):
        source, _ = fivetran_source
        mock_get_services.return_value = []
        found = Mock(spec=Topic)
        found.service = Mock(name="kafka")

        with patch.object(source, "metadata") as mock_metadata:
            mock_metadata.search_in_any_service = Mock(return_value=found)
            source._resolve_topic(topic_name="hr_stream.employee_events")

        assert (
            mock_metadata.search_in_any_service.call_args.kwargs["fqn_search_string"] == '"hr_stream.employee_events"'
        )


class TestSearchAnyService:
    """Pins the FQN slot-padding contract that the cross-service fallback rests on
    (Finding 2/4): leading gaps are dropped for prefix_entity_for_wildcard_search to
    pad back with `*`, interior gaps must stay as explicit `*`, and a missing leaf
    can't be searched for at all."""

    @staticmethod
    def _capture_search_string(source, entity_type, parts):
        captured = {}

        def fake_search(entity_type, fqn_search_string):
            captured["search_string"] = fqn_search_string

        with patch.object(source, "metadata") as mock_metadata:
            mock_metadata.search_in_any_service = Mock(side_effect=fake_search)
            source._search_any_service(entity_type, parts)
        return captured.get("search_string")

    def test_padding_contract_matches_real_helper(self, fivetran_source):
        source, _ = fivetran_source
        search_string = self._capture_search_string(source, Table, [None, "crm", "orders"])
        assert prefix_entity_for_wildcard_search(Table, search_string) == "*.*.crm.orders"

    def test_leading_gap_is_dropped(self, fivetran_source):
        source, _ = fivetran_source
        search_string = self._capture_search_string(source, Table, [None, "crm", "orders"])
        assert search_string == "crm.orders"

    def test_interior_gap_is_kept_as_wildcard(self, fivetran_source):
        source, _ = fivetran_source
        search_string = self._capture_search_string(source, Table, ["dev", None, "users"])
        assert search_string == "dev.*.users"

    def test_missing_leaf_performs_no_search(self, fivetran_source):
        source, _ = fivetran_source
        with patch.object(source, "metadata") as mock_metadata:
            mock_metadata.search_in_any_service = Mock()
            result = source._search_any_service(Table, ["dev", "pub", None])

        assert result is None
        mock_metadata.search_in_any_service.assert_not_called()


class TestFivetranColumnLineage:
    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_happy_path(self, mock_fqn, fivetran_source):
        source, client = fivetran_source
        client.get_connector_column_lineage.return_value = {"src": {"enabled": True, "name_in_destination": "dst"}}
        mock_fqn.side_effect = ["s.d.s.t.src", "s.d.s.t.dst"]
        result = source._fetch_column_lineage(EXPECTED_FIVETRAN_DETAILS, "test", "public", "users", Mock(), Mock())
        assert len(result) == 1
        assert isinstance(result[0], ColumnLineage)

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_skips_none_names(self, mock_fqn, fivetran_source):
        source, client = fivetran_source
        client.get_connector_column_lineage.return_value = {
            None: {"enabled": True, "name_in_destination": "d"},
            "s": {"enabled": True, "name_in_destination": None},
        }
        result = source._fetch_column_lineage(EXPECTED_FIVETRAN_DETAILS, "test", "public", "users", Mock(), Mock())
        assert result == []
        mock_fqn.assert_not_called()

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_skips_disabled(self, mock_fqn, fivetran_source):
        source, client = fivetran_source
        client.get_connector_column_lineage.return_value = {"col": {"enabled": False, "name_in_destination": "d"}}
        result = source._fetch_column_lineage(EXPECTED_FIVETRAN_DETAILS, "test", "public", "users", Mock(), Mock())
        assert result == []
        mock_fqn.assert_not_called()

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_topic_field_fqn")
    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_table_to_topic_uses_topic_field_resolver(self, mock_col_fqn, mock_topic_fqn, fivetran_source):
        source, client = fivetran_source
        client.get_connector_column_lineage.return_value = {"src": {"enabled": True, "name_in_destination": "dst"}}
        mock_col_fqn.return_value = "svc.db.sch.tbl.src"
        mock_topic_fqn.return_value = "kafka.topic.dst"

        topic = Topic.model_construct(id=uuid4(), name="topic")
        result = source._fetch_column_lineage(EXPECTED_FIVETRAN_DETAILS, "test", "public", "users", Mock(), topic)

        assert len(result) == 1
        mock_topic_fqn.assert_called_once_with(topic, "dst")
        assert model_str(result[0].toColumn) == "kafka.topic.dst"

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_topic_field_fqn")
    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_unresolvable_topic_field_is_skipped(self, mock_col_fqn, mock_topic_fqn, fivetran_source):
        source, client = fivetran_source
        client.get_connector_column_lineage.return_value = {"src": {"enabled": True, "name_in_destination": "dst"}}
        mock_col_fqn.return_value = "svc.db.sch.tbl.src"
        mock_topic_fqn.return_value = None

        topic = Topic.model_construct(id=uuid4(), name="topic")
        result = source._fetch_column_lineage(EXPECTED_FIVETRAN_DETAILS, "test", "public", "users", Mock(), topic)

        assert result == []
