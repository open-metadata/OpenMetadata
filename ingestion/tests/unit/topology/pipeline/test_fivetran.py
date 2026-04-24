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
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineState,
    StatusType,
    Task,
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

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/fivetran_dataset.json"
)
with open(mock_file_path) as file:
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
    "https://fivetran.com/dashboard/connectors/aiding_pointless/status"
    "?groupId=wackiness_remote&service=postgres_rds"
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
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
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
        parse_sync_events(
            [("sync-1", "extract_summary", '{"status":"SUCCESS"}', ts[1])], syncs
        )
        parse_sync_events(
            [("sync-1", "sync_end", '{"status":"SUCCESSFUL"}', ts[2])], syncs
        )
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
    with patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    ), patch(
        "metadata.ingestion.source.pipeline.fivetran.connection.get_connection"
    ) as mock_client:
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_FIVETRAN_CONFIG)
        source = FivetranSource.create(
            MOCK_FIVETRAN_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        source.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        source.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root

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
        assert list(source.get_pipelines_list())[0] == EXPECTED_FIVETRAN_DETAILS

    def test_pipeline_name(self, fivetran_source):
        source, _ = fivetran_source
        expected = f'{mock_data["source"]["schema"]} <> {mock_data["group"]["name"]}'
        assert source.get_pipeline_name(EXPECTED_FIVETRAN_DETAILS) == expected

    def test_pipelines(self, fivetran_source):
        source, _ = fivetran_source
        pipeline = list(source.yield_pipeline(EXPECTED_FIVETRAN_DETAILS))[0].right
        assert pipeline == EXPECTED_CREATED_PIPELINES

    def test_pipeline_has_three_elt_tasks(self, fivetran_source):
        source, _ = fivetran_source
        pipeline = list(source.yield_pipeline(EXPECTED_FIVETRAN_DETAILS))[0].right
        assert len(pipeline.tasks) == 3
        assert pipeline.tasks[0].name == FIVETRAN_TASK_EXTRACT
        assert pipeline.tasks[2].name == FIVETRAN_TASK_LOAD

    def test_schedule_interval(self, fivetran_source):
        assert (
            FivetranSource._get_schedule_interval(EXPECTED_FIVETRAN_DETAILS)
            == "0 */6 * * *"
        )

    def test_pipeline_state_active(self, fivetran_source):
        assert (
            FivetranSource._get_pipeline_state(EXPECTED_FIVETRAN_DETAILS)
            == PipelineState.Active
        )

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
        source, client = fivetran_source
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
        assert (
            statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        )
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
        assert (
            statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        )

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
        assert (
            statuses[0].right.pipeline_status.executionStatus == StatusType.Successful
        )


class TestFivetranLineage:
    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    def test_skips_disabled_schemas(self, mock_get_services, fivetran_source):
        source, client = fivetran_source
        mock_get_services.return_value = ["pg"]
        client.get_connector_schema_details.return_value = {
            "s": {
                "enabled": False,
                "name_in_destination": "s",
                "tables": {"t": {"enabled": True}},
            }
        }
        assert (
            list(source.yield_pipeline_lineage_details(EXPECTED_FIVETRAN_DETAILS)) == []
        )

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    @patch("metadata.utils.fqn.build")
    def test_cross_service(self, mock_build, mock_get_services, fivetran_source):
        source, client = fivetran_source
        mock_get_services.return_value = ["pg_svc", "sf_svc"]
        mock_src = Mock()
        mock_src.id = str(uuid4())
        mock_dst = Mock()
        mock_dst.id = str(uuid4())
        mock_pipe = Mock()
        mock_pipe.id.root = str(uuid4())

        mock_build.side_effect = lambda *a, **kw: ".".join(
            str(v)
            for v in [
                kw.get("service_name", ""),
                kw.get("database_name", ""),
                kw.get("schema_name", ""),
                kw.get("table_name", ""),
            ]
            if v
        )

        def side_effect(entity, fqn):
            s = str(fqn)
            if "sf_svc" in s and "users" in s and "users_dest" not in s:
                return mock_src
            if "pg_svc" in s and "users_dest" in s:
                return mock_dst
            if "pipeline" in s or "fivetran" in s:
                return mock_pipe
            return None

        with patch.object(source, "metadata") as mock_metadata:
            mock_metadata.get_by_name = Mock(side_effect=side_effect)
            client.get_connector_schema_details.return_value = {
                "public": {
                    "enabled": True,
                    "name_in_destination": "pub",
                    "tables": {
                        "users": {"enabled": True, "name_in_destination": "users_dest"}
                    },
                }
            }
            client.get_connector_column_lineage.return_value = {}
            result = list(
                source.yield_pipeline_lineage_details(EXPECTED_FIVETRAN_DETAILS)
            )
            assert len(result) == 1
            assert str(result[0].right.edge.fromEntity.id.root) == mock_src.id

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    @patch("metadata.utils.fqn.build")
    def test_skips_self_ref(self, mock_build, mock_get_services, fivetran_source):
        source, client = fivetran_source
        mock_get_services.return_value = ["pg"]
        same_id = str(uuid4())
        mock_table = Mock()
        mock_table.id = same_id

        mock_build.side_effect = lambda *a, **kw: "pg.db.public.orders"

        with patch.object(source, "metadata") as mock_metadata:
            mock_metadata.get_by_name = Mock(
                side_effect=lambda entity, fqn: mock_table
                if "orders" in str(fqn)
                else None
            )
            client.get_connector_schema_details.return_value = {
                "public": {
                    "enabled": True,
                    "name_in_destination": "public",
                    "tables": {
                        "orders": {"enabled": True, "name_in_destination": "orders"}
                    },
                }
            }
            client.get_connector_column_lineage.return_value = {}
            assert (
                list(source.yield_pipeline_lineage_details(EXPECTED_FIVETRAN_DETAILS))
                == []
            )

    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_messaging_service_names"
    )
    @patch(
        "metadata.ingestion.source.pipeline.fivetran.metadata.FivetranSource.get_db_service_names"
    )
    @patch("metadata.utils.fqn.build")
    def test_messaging_lineage(self, mock_build, mock_db, mock_msg, fivetran_source):
        source, client = fivetran_source
        mock_db.return_value = ["sf"]
        mock_msg.return_value = ["kafka"]
        mock_topic = Mock()
        mock_topic.id = str(uuid4())
        mock_table = Mock()
        mock_table.id = str(uuid4())
        mock_pipe = Mock()
        mock_pipe.id.root = str(uuid4())

        def build_se(*a, **kw):
            if kw.get("topic_name"):
                return f"{kw['service_name']}.{kw['topic_name']}"
            return ".".join(
                str(v)
                for v in [kw.get("service_name", ""), kw.get("table_name", "")]
                if v
            )

        mock_build.side_effect = build_se

        def side_effect(entity, fqn):
            s = str(fqn)
            if "kafka" in s:
                return mock_topic
            if "sf" in s:
                return mock_table
            if "pipeline" in s or "fivetran" in s:
                return mock_pipe
            return None

        with patch.object(source, "metadata") as mock_metadata:
            mock_metadata.get_by_name = Mock(side_effect=side_effect)
            client.get_connector_schema_details.return_value = {
                "topics": {
                    "enabled": True,
                    "name_in_destination": "cc",
                    "tables": {
                        "TRADES": {"enabled": True, "name_in_destination": "TRADES"}
                    },
                }
            }
            details = FivetranPipelineDetails(
                source={
                    "id": "cc",
                    "service": "confluent_cloud",
                    "schema": "cc",
                    "config": {},
                },
                destination=mock_data["destination"],
                group=mock_data["group"],
                connector_id="cc",
            )
            result = list(source.yield_pipeline_lineage_details(details))
            assert len(result) == 1
            assert result[0].right.edge.fromEntity.type == "topic"


class TestFivetranColumnLineage:
    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_happy_path(self, mock_fqn, fivetran_source):
        source, client = fivetran_source
        client.get_connector_column_lineage.return_value = {
            "src": {"enabled": True, "name_in_destination": "dst"}
        }
        mock_fqn.side_effect = ["s.d.s.t.src", "s.d.s.t.dst"]
        result = source._fetch_column_lineage(
            EXPECTED_FIVETRAN_DETAILS, "test", "public", "users", Mock(), Mock()
        )
        assert len(result) == 1
        assert isinstance(result[0], ColumnLineage)

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_skips_none_names(self, mock_fqn, fivetran_source):
        source, client = fivetran_source
        client.get_connector_column_lineage.return_value = {
            None: {"enabled": True, "name_in_destination": "d"},
            "s": {"enabled": True, "name_in_destination": None},
        }
        result = source._fetch_column_lineage(
            EXPECTED_FIVETRAN_DETAILS, "test", "public", "users", Mock(), Mock()
        )
        assert result == []
        mock_fqn.assert_not_called()

    @patch("metadata.ingestion.source.pipeline.fivetran.metadata.get_column_fqn")
    def test_skips_disabled(self, mock_fqn, fivetran_source):
        source, client = fivetran_source
        client.get_connector_column_lineage.return_value = {
            "col": {"enabled": False, "name_in_destination": "d"}
        }
        result = source._fetch_column_lineage(
            EXPECTED_FIVETRAN_DETAILS, "test", "public", "users", Mock(), Mock()
        )
        assert result == []
        mock_fqn.assert_not_called()
