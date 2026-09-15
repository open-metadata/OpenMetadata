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
Unit tests for the Prefect pipeline connector.
"""

import base64
import uuid
from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.services.connections.pipeline.prefect.cloudAuth import (
    PrefectCloudAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.prefect.serverAuth import (
    PrefectServerAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.prefectConnection import (
    PrefectConnection as PrefectConnectionConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.tagLabel import LabelType, State, TagLabel, TagSource
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.ingestion.source.pipeline.prefect.client import (
    DEPLOYMENTS_PAGE_SIZE,
    FLOWS_PAGE_SIZE,
    PrefectClient,
)
from metadata.ingestion.source.pipeline.prefect.metadata import (
    PrefectSource,
    _parse_timestamp,
)
from metadata.ingestion.source.pipeline.prefect.models import (
    AssetMaterialization,
    PrefectDeployment,
    PrefectDeploymentSchedule,
    PrefectFlow,
    PrefectFlowRun,
    PrefectScheduleDetail,
    PrefectTaskRun,
    TaskInputRef,
)

MOCK_CONFIG = {
    "source": {
        "type": "prefect",
        "serviceName": "test_prefect",
        "serviceConnection": {
            "config": {
                "type": "Prefect",
                "hostPort": "https://api.prefect.cloud",
                "authType": {
                    "apiKey": "test_key",
                    "accountId": "test_account",
                    "workspaceId": "test_workspace",
                },
                "numberOfStatus": 10,
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    }
}

MOCK_FLOWS = [
    PrefectFlow(id="flow-1", name="test-flow"),
    PrefectFlow(id="flow-2", name="etl-pipeline"),
]

MOCK_DEPLOYMENTS = [
    PrefectDeployment(
        tags=["nightly"],
        schedules=[
            PrefectDeploymentSchedule(active=True, schedule=PrefectScheduleDetail(cron="0 0 * * *")),
        ],
    )
]

MOCK_FLOW_RUNS = [
    PrefectFlowRun(
        id="run-1", state_type="COMPLETED", start_time="2024-04-19T10:00:00Z", end_time="2024-04-19T10:05:00Z"
    ),
    PrefectFlowRun(id="run-2", state_type="FAILED", start_time="2024-04-19T11:00:00Z", end_time="2024-04-19T11:02:00Z"),
    PrefectFlowRun(id="run-3", state_type="SOME_FUTURE_STATE", start_time="2024-04-19T12:00:00Z", end_time=None),
]


def _client(auth=None, host_port="http://localhost:4200") -> PrefectClient:
    client = PrefectClient(PrefectConnectionConfig(hostPort=host_port, authType=auth or PrefectServerAuthentication()))
    client.client = Mock()
    return client


@pytest.fixture
def prefect_source() -> PrefectSource:
    workflow_source = WorkflowSource.model_validate(MOCK_CONFIG["source"])
    with patch.object(PipelineServiceSource, "test_connection"):
        source = PrefectSource(workflow_source, Mock())
    source.client = Mock(spec=PrefectClient)
    return source


def _self_hosted_source() -> PrefectSource:
    """Self-hosted config with no accountId/workspaceId, hostPort carrying
    the /api suffix — a documented-valid input (see test_self_hosted_api_suffix_is_not_duplicated)."""
    config = {
        "type": "prefect",
        "serviceName": "test_prefect_self_hosted",
        "serviceConnection": {
            "config": {"type": "Prefect", "hostPort": "http://localhost:4200/api", "authType": {}},
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    }
    workflow_source = WorkflowSource.model_validate(config)
    with patch.object(PipelineServiceSource, "test_connection"):
        source = PrefectSource(workflow_source, Mock())
    source.client = Mock(spec=PrefectClient)
    return source


def _context(**overrides):
    defaults = {"pipeline_service": "test_prefect", "pipeline": "test-flow", "task_names": set()}
    return Mock(**{**defaults, **overrides})


class TestPrefectClient:
    """The client owns URL building, filter payloads and pagination."""

    def test_cloud_path_prefix(self):
        client = _client(PrefectCloudAuthentication(apiKey="test_key", accountId="acct", workspaceId="ws"))

        assert client._path_prefix == "/accounts/acct/workspaces/ws"

    def test_self_hosted_api_suffix_is_not_duplicated(self):
        client = PrefectClient(
            PrefectConnectionConfig(hostPort="http://localhost:4200/api", authType=PrefectServerAuthentication())
        )

        assert client.client.config.base_url == "http://localhost:4200"
        assert client._path_prefix == ""

    def test_cloud_auth_requires_all_fields_together(self):
        """accountId alone matches neither the Cloud (missing apiKey/workspaceId)
        nor Server auth schema, so it's rejected at config validation time
        rather than by a hand-rolled check in the client."""
        with pytest.raises(ValidationError):
            PrefectCloudAuthentication(accountId="only-account")

    def test_no_auth_when_authstring_empty(self):
        client = PrefectClient(
            PrefectConnectionConfig(hostPort="http://localhost:4200", authType=PrefectServerAuthentication())
        )

        assert client.client.config.auth_header is None
        assert client.client.config.auth_token is None

    def test_bearer_auth_for_cloud(self):
        client = PrefectClient(
            PrefectConnectionConfig(
                hostPort="https://api.prefect.cloud",
                authType=PrefectCloudAuthentication(apiKey="test_key", accountId="acct", workspaceId="ws"),
            )
        )

        assert client.client.config.auth_header == "Authorization"
        assert client.client.config.auth_token_mode == "Bearer"
        assert client.client.config.auth_token()[0] == "test_key"

    def test_basic_auth_when_authstring_set(self):
        client = PrefectClient(
            PrefectConnectionConfig(
                hostPort="http://localhost:4200",
                authType=PrefectServerAuthentication(authString="admin:secret"),
            )
        )

        assert client.client.config.auth_header == "Authorization"
        assert client.client.config.auth_token_mode == "Basic"
        assert client.client.config.auth_token()[0] == base64.b64encode(b"admin:secret").decode()

    def test_flow_runs_filter_targets_the_flow_and_excludes_scheduled(self):
        client = _client()
        client.client.post.return_value = [{"id": "run-1", "state_type": "COMPLETED"}]

        runs = client.get_flow_runs("flow-1", limit=10)

        assert [run.id for run in runs] == ["run-1"]
        payload = client.client.post.call_args.kwargs["json"]
        assert payload["flows"] == {"id": {"any_": ["flow-1"]}}
        assert payload["limit"] == 10
        assert payload["flow_runs"] == {"state": {"type": {"not_any_": ["SCHEDULED"]}}}

    def test_deployments_filter_targets_the_flow_and_paginates(self):
        client = _client()
        full_page = [{} for _ in range(DEPLOYMENTS_PAGE_SIZE)]
        client.client.post.side_effect = [full_page, [{}]]

        deployments = client.get_deployments("flow-1")

        assert len(deployments) == DEPLOYMENTS_PAGE_SIZE + 1
        first_call, second_call = client.client.post.call_args_list
        assert first_call.kwargs["json"]["flows"] == {"id": {"any_": ["flow-1"]}}
        assert first_call.kwargs["json"]["offset"] == 0
        assert second_call.kwargs["json"]["offset"] == DEPLOYMENTS_PAGE_SIZE

    def test_task_runs_filter_targets_the_run_and_paginates(self):
        client = _client()
        full_page = [{"id": f"tr-{index}", "flow_run_id": "run-1"} for index in range(200)]
        client.client.post.side_effect = [full_page, [{"id": "tr-last", "flow_run_id": "run-1"}]]

        task_runs = client.get_task_runs("run-1")

        assert len(task_runs) == 201
        first_call, second_call = client.client.post.call_args_list
        assert first_call.kwargs["json"]["task_runs"] == {"flow_run_id": {"any_": ["run-1"]}}
        assert first_call.kwargs["json"]["offset"] == 0
        assert second_call.kwargs["json"]["offset"] == 200

    def test_task_runs_for_flow_runs_groups_by_flow_run_id(self):
        client = _client()
        client.client.post.return_value = [
            {"id": "tr-1", "flow_run_id": "run-1"},
            {"id": "tr-2", "flow_run_id": "run-2"},
        ]

        grouped = client.get_task_runs_for_flow_runs(["run-1", "run-2"])

        assert [t.id for t in grouped["run-1"]] == ["tr-1"]
        assert [t.id for t in grouped["run-2"]] == ["tr-2"]

    def test_task_runs_for_flow_runs_returns_empty_dict_for_no_ids(self):
        client = _client()

        assert client.get_task_runs_for_flow_runs([]) == {}
        client.client.post.assert_not_called()

    def test_flows_pagination_advances_offset(self):
        client = _client()
        full_page = [{"id": f"flow-{index}", "name": f"flow-{index}"} for index in range(FLOWS_PAGE_SIZE)]
        client.client.post.side_effect = [full_page, []]

        flows = list(client.get_flows())

        assert len(flows) == FLOWS_PAGE_SIZE
        second_call = client.client.post.call_args_list[1]
        assert second_call.kwargs["json"]["offset"] == FLOWS_PAGE_SIZE

    def test_filter_returns_empty_list_when_response_is_not_a_list(self):
        client = _client()
        client.client.post.return_value = {"error": "boom"}

        assert client.get_flow_runs("flow-x", limit=1) == []

    def test_get_asset_materializations(self):
        client = _client()
        client.client.get.return_value = [{"asset_key": "postgres://h/db/schema/t", "upstream_assets": []}]

        result = client.get_asset_materializations("run-1")

        assert len(result) == 1
        assert result[0].asset_key == "postgres://h/db/schema/t"
        client.client.get.assert_called_once_with("/flow_runs/run-1/assets/materializations")

    def test_get_asset_materializations_returns_empty_when_not_a_list(self):
        client = _client()
        client.client.get.return_value = {"error": "not found"}

        assert client.get_asset_materializations("run-1") == []

    def test_check_access_uses_zero_retries(self):
        client = _client()
        client.client.post.return_value = []

        client.test_check_access()

        assert client.client.post.call_args.kwargs["retries"] == 0

    def test_get_flows_for_test_connection(self):
        client = _client()
        client.client.post.return_value = [{"id": "flow-1", "name": "test-flow"}]

        assert client.test_get_flows() == [{"id": "flow-1", "name": "test-flow"}]


class TestParseAssetKey:
    """Static parsing of Prefect asset key URIs into (database, schema, table)."""

    def test_three_segments(self):
        assert PrefectSource._parse_asset_key("postgres://myhost.example.com/mydb/public/orders") == (
            "mydb",
            "public",
            "orders",
        )

    def test_two_segments_has_no_database(self):
        assert PrefectSource._parse_asset_key("mysql://myhost/mydb/orders") == (None, "mydb", "orders")

    def test_one_segment_is_table_only(self):
        assert PrefectSource._parse_asset_key("warehouse://myhost/orders_table") == (None, None, "orders_table")

    def test_bare_host_with_no_path_is_none(self):
        assert PrefectSource._parse_asset_key("s3://bucket") is None

    def test_missing_scheme_is_none(self):
        assert PrefectSource._parse_asset_key("not-a-uri") is None


class TestSplitLineageTagIdentifier:
    """Static splitting of an 'om-source'/'om-destination' tag's dotted identifier."""

    def test_three_parts(self):
        assert PrefectSource._split_lineage_tag_identifier("mysql.sales.orders") == ("mysql", "sales", "orders")

    def test_rejects_too_few_parts(self):
        assert PrefectSource._split_lineage_tag_identifier("not-enough-parts") is None

    def test_rejects_too_many_parts(self):
        assert PrefectSource._split_lineage_tag_identifier("a.b.c.d") is None


class TestParseTimestamp:
    def test_parses_iso_string_with_z_suffix(self):
        timestamp = _parse_timestamp("2024-04-19T10:00:00Z")

        assert timestamp == 1713520800000
        assert isinstance(timestamp, int)

    def test_none_when_input_is_none_or_empty(self):
        assert _parse_timestamp(None) is None
        assert _parse_timestamp("") is None

    def test_none_when_input_is_malformed(self):
        assert _parse_timestamp("not-a-timestamp") is None


class TestPrefectSourceCreate:
    def test_create_builds_a_source_from_a_valid_config(self):
        with patch.object(PipelineServiceSource, "test_connection"):
            source = PrefectSource.create(MOCK_CONFIG["source"], Mock())

        assert isinstance(source, PrefectSource)


class TestPrefectSource:
    """The source turns client payloads into OpenMetadata requests."""

    def test_get_pipelines_list(self, prefect_source):
        prefect_source.client.get_flows.return_value = iter(MOCK_FLOWS)

        assert list(prefect_source.get_pipelines_list()) == MOCK_FLOWS

    def test_get_pipeline_name(self, prefect_source):
        assert prefect_source.get_pipeline_name(MOCK_FLOWS[0]) == "test-flow"

    def test_yield_pipeline_registers_the_record(self, prefect_source):
        """Regression test: a flow that isn't registered gets marked deleted on
        the next run when markDeletedPipelines is on (the mass-deletion bug)."""
        prefect_source.client.get_deployments.return_value = MOCK_DEPLOYMENTS
        prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
        prefect_source.client.get_task_runs.return_value = [
            PrefectTaskRun(id="tr-1", flow_run_id="run-1", name="extract")
        ]
        stub_tags = [
            TagLabel(
                tagFQN="PrefectTags.production",
                source=TagSource.Classification,
                labelType=LabelType.Automated,
                state=State.Suggested,
            )
        ]

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels",
                return_value=stub_tags,
            ),
            patch.object(prefect_source, "register_record") as mock_register,
        ):
            results = list(prefect_source.yield_pipeline(MOCK_FLOWS[0]))

        assert len(results) == 1
        request = results[0].right
        assert request is not None
        assert request.name.root == "test-flow"
        assert len(request.tasks) == 1
        assert request.tasks[0].name == "extract"
        assert request.tags == stub_tags
        mock_register.assert_called_once_with(pipeline_request=request)

    def test_yield_pipeline_error_is_a_stack_trace_error(self, prefect_source):
        """Either.left must be a StackTraceError, not a raw exception, or
        Pydantic validation on the Either itself blows up."""
        prefect_source.client.get_deployments.side_effect = RuntimeError("boom")

        results = list(prefect_source.yield_pipeline(MOCK_FLOWS[0]))

        assert len(results) == 1
        assert results[0].right is None
        assert results[0].left is not None
        assert "boom" in results[0].left.error

    def test_yield_pipeline_self_hosted_source_url_strips_api_suffix(self):
        """hostPort may carry /api (the client strips it for API calls too,
        see test_self_hosted_api_suffix_is_not_duplicated) — the Prefect UI
        itself is served without it, so a dead link would result otherwise."""
        source = _self_hosted_source()
        source.client.get_deployments.return_value = []
        source.client.get_flow_runs.return_value = []
        source.client.get_task_runs.return_value = []

        with (
            patch.object(source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels",
                return_value=None,
            ),
        ):
            results = list(source.yield_pipeline(MOCK_FLOWS[1]))

        assert len(results) == 1
        assert results[0].right.sourceUrl.root == "http://localhost:4200/flows/flow/flow-2"

    def test_yield_tag_delegates_to_tag_utils(self, prefect_source):
        """Flow-level tags are never a source (nothing in the Prefect SDK
        writes them, see _get_all_tags) — only deployment and task-run tags
        are merged."""
        prefect_source.client.get_deployments.return_value = [PrefectDeployment(tags=["nightly"])]
        prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
        prefect_source.client.get_task_runs.return_value = [
            PrefectTaskRun(id="tr-1", flow_run_id="run-1", tags=["urgent"])
        ]

        with patch(
            "metadata.ingestion.source.pipeline.prefect.metadata.get_ometa_tag_and_classification",
            return_value=iter(["stub-tag"]),
        ) as mock_get_tags:
            results = list(prefect_source.yield_tag(MOCK_FLOWS[0]))

        assert results == ["stub-tag"]
        _, kwargs = mock_get_tags.call_args
        assert set(kwargs["tags"]) == {"nightly", "urgent"}
        assert kwargs["classification_name"] == "PrefectTags"

    def test_yield_tag_skips_task_fetch_when_flow_never_ran(self, prefect_source):
        """No flow runs yet means no task runs to fetch, not a crash."""
        prefect_source.client.get_deployments.return_value = []
        prefect_source.client.get_flow_runs.return_value = []

        with patch(
            "metadata.ingestion.source.pipeline.prefect.metadata.get_ometa_tag_and_classification",
            return_value=iter([]),
        ):
            list(prefect_source.yield_tag(MOCK_FLOWS[0]))

        prefect_source.client.get_task_runs.assert_not_called()

    def test_build_task_dag_resolves_task_level_tags(self, prefect_source):
        """Each Task's own tags are resolved into TagLabels via the same
        PrefectTags classification used for pipeline-level tags."""
        task_runs = [
            PrefectTaskRun(id="tr-1", flow_run_id="run-1", name="extract", tags=["urgent", "pii"]),
            PrefectTaskRun(id="tr-2", flow_run_id="run-1", name="load", tags=[]),
        ]

        with patch(
            "metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels",
            return_value=None,
        ) as mock_get_tag_labels:
            prefect_source._build_task_dag(task_runs)

        assert len(mock_get_tag_labels.call_args_list) == 2
        assert set(mock_get_tag_labels.call_args_list[0].kwargs["tags"]) == {"urgent", "pii"}
        assert mock_get_tag_labels.call_args_list[1].kwargs["tags"] == []
        for call in mock_get_tag_labels.call_args_list:
            assert call.kwargs["classification_name"] == "PrefectTags"

    def test_build_task_dag_links_downstream_tasks_via_task_inputs(self, prefect_source):
        task_runs = [
            PrefectTaskRun(id="tr-1", flow_run_id="run-1", task_key="extract", name="extract-abc"),
            PrefectTaskRun(
                id="tr-2",
                flow_run_id="run-1",
                task_key="load",
                name="load-xyz",
                task_inputs={"data": [TaskInputRef(id="tr-1")]},
            ),
        ]

        with patch("metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels", return_value=None):
            tasks = prefect_source._build_task_dag(task_runs)

        by_name = {task.name: task for task in tasks}
        assert by_name["extract"].downstreamTasks == ["load"]
        assert by_name["load"].downstreamTasks is None

    def test_build_task_dag_collapses_repeated_calls_of_same_task(self, prefect_source):
        """A task called more than once in a loop shares one task_key, so it
        contributes one Task, not one per call."""
        task_runs = [
            PrefectTaskRun(id="tr-1", flow_run_id="run-1", task_key="extract", name="extract-run-1"),
            PrefectTaskRun(id="tr-2", flow_run_id="run-1", task_key="extract", name="extract-run-2"),
        ]

        with patch("metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels", return_value=None):
            tasks = prefect_source._build_task_dag(task_runs)

        assert len(tasks) == 1
        assert tasks[0].name == "extract"

    def test_build_task_dag_ignores_task_input_ref_with_no_id(self, prefect_source):
        """A task_inputs ref with id=None (a constant/literal input, not
        another task's output) must not be treated as an upstream task."""
        task_runs = [
            PrefectTaskRun(
                id="tr-1",
                flow_run_id="run-1",
                task_key="load",
                name="load-xyz",
                task_inputs={"data": [TaskInputRef(id=None)]},
            ),
        ]

        with patch("metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels", return_value=None):
            tasks = prefect_source._build_task_dag(task_runs)

        assert tasks[0].downstreamTasks is None

    def test_yield_pipeline_status_wraps_in_ometa_pipeline_status(self, prefect_source):
        prefect_source.client.get_flow_runs.return_value = MOCK_FLOW_RUNS
        prefect_source.client.get_task_runs_for_flow_runs.return_value = {}

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
        ):
            results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

        assert len(results) == 3
        for result in results:
            assert result.right is not None
            assert result.right.pipeline_fqn == "test_prefect.test-flow"

        assert results[0].right.pipeline_status.executionStatus.value == "Successful"
        assert results[1].right.pipeline_status.executionStatus.value == "Failed"
        # An unrecognized state defaults to Pending, not Failed
        assert results[2].right.pipeline_status.executionStatus.value == "Pending"

    def test_yield_pipeline_status_nests_real_task_statuses_per_run(self, prefect_source):
        """Each PipelineStatus entry nests that specific flow run's own real
        task runs — not a stand-in derived from the deployment name."""
        prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
        prefect_source.client.get_task_runs_for_flow_runs.return_value = {
            "run-1": [
                PrefectTaskRun(
                    id="tr-1",
                    flow_run_id="run-1",
                    name="extract",
                    state_type="COMPLETED",
                    start_time="2024-04-19T10:00:00Z",
                    end_time="2024-04-19T10:01:00Z",
                )
            ]
        }

        with (
            patch.object(prefect_source.context, "get", return_value=_context(task_names={"extract"})),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
        ):
            results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

        prefect_source.client.get_task_runs_for_flow_runs.assert_called_once_with(["run-1"])
        task_status = results[0].right.pipeline_status.taskStatus
        assert len(task_status) == 1
        assert task_status[0].name == "extract"
        assert task_status[0].executionStatus.value == "Successful"

    def test_yield_pipeline_status_drops_task_status_not_on_current_pipeline(self, prefect_source):
        """The server rejects a taskStatus name absent from Pipeline.tasks
        (validateTask, PipelineRepository.java) — a run with a task the
        current pipeline no longer has (renamed/removed since) must have
        that entry dropped, not sent, same as the Airflow connector does."""
        prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
        prefect_source.client.get_task_runs_for_flow_runs.return_value = {
            "run-1": [
                PrefectTaskRun(
                    id="tr-1",
                    flow_run_id="run-1",
                    name="extract",
                    state_type="COMPLETED",
                    start_time="2024-04-19T10:00:00Z",
                ),
                PrefectTaskRun(
                    id="tr-2",
                    flow_run_id="run-1",
                    name="transform",
                    state_type="COMPLETED",
                    start_time="2024-04-19T10:00:00Z",
                ),
            ]
        }

        with (
            patch.object(prefect_source.context, "get", return_value=_context(task_names={"extract"})),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
        ):
            results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

        task_status = results[0].right.pipeline_status.taskStatus
        assert [t.name for t in task_status] == ["extract"]

    def test_yield_pipeline_stashes_task_names_for_status_step(self, prefect_source):
        """yield_pipeline_status reads context.task_names back instead of
        re-fetching the latest run — mirrors the Airflow connector's pattern."""
        prefect_source.client.get_deployments.return_value = []
        prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
        prefect_source.client.get_task_runs.return_value = [
            PrefectTaskRun(id="tr-1", flow_run_id="run-1", name="extract")
        ]
        context = _context()

        with (
            patch.object(prefect_source.context, "get", return_value=context),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels",
                return_value=None,
            ),
        ):
            list(prefect_source.yield_pipeline(MOCK_FLOWS[0]))

        assert context.task_names == {"extract"}

    def test_yield_pipeline_stashes_empty_task_names_on_failure(self, prefect_source):
        """A flow that fails in yield_pipeline must still leave task_names
        set (to empty) so yield_pipeline_status doesn't crash reading it."""
        prefect_source.client.get_deployments.side_effect = RuntimeError("boom")
        context = _context(task_names=Mock())  # anything non-empty/unset beforehand

        with patch.object(prefect_source.context, "get", return_value=context):
            list(prefect_source.yield_pipeline(MOCK_FLOWS[0]))

        assert context.task_names == set()

    def test_yield_pipeline_status_skips_runs_without_a_timestamp(self, prefect_source):
        """PipelineStatus.timestamp is a required field — a run with neither
        start_time nor expected_start_time can't produce one and must be
        skipped, not raise (which would previously drop every status)."""
        no_timestamp_run = PrefectFlowRun(id="run-x", state_type="PENDING", start_time=None, end_time=None)
        prefect_source.client.get_flow_runs.return_value = [no_timestamp_run, MOCK_FLOW_RUNS[0]]
        prefect_source.client.get_task_runs_for_flow_runs.return_value = {}

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
        ):
            results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

        assert len(results) == 1
        assert results[0].right.pipeline_status.executionStatus.value == "Successful"

    def test_yield_pipeline_status_error_is_a_stack_trace_error(self, prefect_source):
        prefect_source.client.get_flow_runs.side_effect = RuntimeError("boom")

        results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

        assert len(results) == 1
        assert results[0].right is None
        assert "boom" in results[0].left.error

    def test_parse_lineage_from_tags_preserves_case(self, prefect_source):
        """Only the 'om-' prefix is case-insensitive; a bare 'source:' tag
        (unrelated tagging convention) must not be picked up."""
        tags = [
            "production",
            "OM-SOURCE:MySQL.Sales.Orders",
            "om-destination:mysql.analytics.SUMMARY",
            "source:legacy.Schema.Table",
            "etl",
        ]

        sources, destinations = prefect_source._parse_lineage_from_tags(tags)

        assert sources == ["MySQL.Sales.Orders"]
        assert destinations == ["mysql.analytics.SUMMARY"]

    def test_parse_lineage_from_tags_ignores_empty_identifier(self, prefect_source):
        """A bare 'om-source:' tag with nothing after the prefix must not
        produce an empty-string identifier."""
        sources, destinations = prefect_source._parse_lineage_from_tags(["om-source:", "production"])

        assert sources == []
        assert destinations == []

    def test_schedule_interval_reads_cron_from_schedules_list(self, prefect_source):
        """Prefect 3.x deployments use a `schedules` list, not a singular
        `schedule` field — this must read the real shape."""
        assert prefect_source._schedule_interval(MOCK_DEPLOYMENTS) == "0 0 * * *"

    def test_schedule_interval_skips_inactive_and_reads_interval(self, prefect_source):
        deployments = [
            PrefectDeployment(
                schedules=[
                    PrefectDeploymentSchedule(active=False, schedule=PrefectScheduleDetail(cron="0 0 * * *")),
                    PrefectDeploymentSchedule(active=True, schedule=PrefectScheduleDetail(interval=3600)),
                ]
            )
        ]

        assert prefect_source._schedule_interval(deployments) == "every 3600.0s"

    def test_schedule_interval_reads_rrule(self, prefect_source):
        deployments = [
            PrefectDeployment(
                schedules=[
                    PrefectDeploymentSchedule(
                        active=True, schedule=PrefectScheduleDetail(rrule="FREQ=DAILY;INTERVAL=1")
                    ),
                ]
            )
        ]

        assert prefect_source._schedule_interval(deployments) == "FREQ=DAILY;INTERVAL=1"

    def test_schedule_interval_skips_entry_with_no_schedule_kind_set(self, prefect_source):
        """An active entry whose schedule has none of cron/interval/rrule set
        must be skipped in favor of the next entry, not treated as a match."""
        deployments = [
            PrefectDeployment(
                schedules=[
                    PrefectDeploymentSchedule(active=True, schedule=PrefectScheduleDetail()),
                    PrefectDeploymentSchedule(active=True, schedule=PrefectScheduleDetail(cron="0 0 * * *")),
                ]
            )
        ]

        assert prefect_source._schedule_interval(deployments) == "0 0 * * *"

    def test_schedule_interval_none_when_no_deployments_or_schedules(self, prefect_source):
        assert prefect_source._schedule_interval([]) is None
        assert prefect_source._schedule_interval([PrefectDeployment(schedules=[])]) is None

    def test_get_all_tags_merges_deployment_and_task_tags(self, prefect_source):
        """Flow-level tags are excluded on purpose — see _get_all_tags."""
        deployments = [
            PrefectDeployment(tags=["dep-tag1"]),
            PrefectDeployment(tags=["dep-tag2", "shared-tag"]),
        ]
        task_runs = [PrefectTaskRun(id="tr-1", flow_run_id="run-1", tags=["shared-tag", "task-tag"])]

        all_tags = prefect_source._get_all_tags(deployments, task_runs)

        assert sorted(all_tags) == ["dep-tag1", "dep-tag2", "shared-tag", "task-tag"]

    def test_get_all_tags_with_no_task_runs(self, prefect_source):
        deployments = [PrefectDeployment(tags=["dep-tag1"])]

        assert prefect_source._get_all_tags(deployments) == ["dep-tag1"]

    def test_resolve_table_fqn_returns_first_service_where_table_exists(self, prefect_source):
        prefect_source.get_db_service_names = Mock(return_value=["svc1", "svc2"])
        tables = {"svc2.mysql.sales.orders": Mock()}
        prefect_source.metadata.get_by_name.side_effect = lambda entity, fqn: tables.get(fqn)

        def fake_build(**kwargs):
            return f"{kwargs['service_name']}.{kwargs['database_name']}.{kwargs['schema_name']}.{kwargs['table_name']}"

        with patch("metadata.ingestion.source.pipeline.prefect.metadata.fqn.build", side_effect=fake_build):
            result = prefect_source._resolve_table_fqn("mysql", "sales", "orders")

        assert result == "svc2.mysql.sales.orders"

    def test_resolve_table_fqn_returns_none_when_no_service_has_the_table(self, prefect_source):
        prefect_source.get_db_service_names = Mock(return_value=["svc1"])
        prefect_source.metadata.get_by_name.return_value = None

        with patch(
            "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
            return_value="svc1.mysql.sales.orders2",
        ):
            assert prefect_source._resolve_table_fqn("mysql", "sales", "orders2") is None

    def test_resolve_table_fqn_returns_none_when_no_services_configured(self, prefect_source):
        prefect_source.get_db_service_names = Mock(return_value=[])

        assert prefect_source._resolve_table_fqn("mysql", "sales", "orders3") is None

    def test_yield_pipeline_lineage_details_builds_table_to_table_edges(self, prefect_source):
        pipeline_entity = Mock()
        pipeline_entity.id = Uuid(uuid.uuid4())
        source_table = Mock(id=uuid.uuid4())
        dest_table = Mock(id=uuid.uuid4())

        def get_by_name(entity, fqn, **kwargs):
            if entity is Pipeline:
                return pipeline_entity
            return {
                "svc.mysql.sales.orders": source_table,
                "svc.mysql.analytics.summary": dest_table,
            }.get(fqn)

        def resolve_fqn(database, schema, table):
            return {
                ("mysql", "sales", "orders"): "svc.mysql.sales.orders",
                ("mysql", "analytics", "summary"): "svc.mysql.analytics.summary",
            }.get((database, schema, table))

        prefect_source.metadata.get_by_name.side_effect = get_by_name
        prefect_source.client.get_deployments.return_value = [
            PrefectDeployment(tags=["om-source:mysql.sales.orders", "om-destination:mysql.analytics.summary"])
        ]
        # Cloud config: force the flow straight to tag-based lineage, no runs to check for assets.
        prefect_source.client.get_flow_runs.return_value = []

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
            patch.object(prefect_source, "_resolve_table_fqn", side_effect=resolve_fqn),
        ):
            results = list(prefect_source.yield_pipeline_lineage_details(MOCK_FLOWS[0]))

        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.id.root == source_table.id
        assert edge.fromEntity.type == "table"
        assert edge.toEntity.id.root == dest_table.id
        assert edge.toEntity.type == "table"
        assert edge.lineageDetails.source == LineageSource.PipelineLineage
        assert edge.lineageDetails.pipeline.id.root == pipeline_entity.id.root

    def test_yield_pipeline_lineage_details_links_every_source_to_every_destination(self, prefect_source):
        """Tags carry no per-pair mapping, so every detected source is linked
        to every detected destination. A source/destination identifier that
        doesn't resolve to a real table is dropped, not sent as a broken edge."""
        pipeline_entity = Mock()
        pipeline_entity.id = Uuid(uuid.uuid4())
        source_table = Mock(id=uuid.uuid4())
        dest_table = Mock(id=uuid.uuid4())

        def get_by_name(entity, fqn, **kwargs):
            if entity is Pipeline:
                return pipeline_entity
            return {
                "svc.mysql.sales.orders": source_table,
                "svc.mysql.analytics.summary": dest_table,
            }.get(fqn)

        def resolve_fqn(database, schema, table):
            return {
                ("mysql", "sales", "orders"): "svc.mysql.sales.orders",
                ("mysql", "analytics", "summary"): "svc.mysql.analytics.summary",
            }.get((database, schema, table))  # "missing" resolves to None

        prefect_source.metadata.get_by_name.side_effect = get_by_name
        prefect_source.client.get_deployments.return_value = [
            PrefectDeployment(
                tags=[
                    "om-source:mysql.sales.orders",
                    "om-source:mysql.sales.missing",
                    "om-destination:mysql.analytics.summary",
                ]
            )
        ]
        prefect_source.client.get_flow_runs.return_value = []

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
            patch.object(prefect_source, "_resolve_table_fqn", side_effect=resolve_fqn),
        ):
            results = list(prefect_source.yield_pipeline_lineage_details(MOCK_FLOWS[0]))

        # Only the resolvable source is linked — the missing one is dropped, not sent broken.
        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.id.root == source_table.id
        assert edge.toEntity.id.root == dest_table.id

    def test_yield_pipeline_lineage_details_skips_when_only_one_side_present(self, prefect_source):
        pipeline_entity = Mock()
        prefect_source.metadata.get_by_name.return_value = pipeline_entity
        prefect_source.client.get_deployments.return_value = [PrefectDeployment(tags=["om-source:mysql.sales.orders"])]
        prefect_source.client.get_flow_runs.return_value = []

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
        ):
            results = list(prefect_source.yield_pipeline_lineage_details(MOCK_FLOWS[0]))

        assert results == []

    def test_yield_pipeline_lineage_details_returns_when_pipeline_not_found(self, prefect_source):
        prefect_source.metadata.get_by_name.return_value = None

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
        ):
            results = list(prefect_source.yield_pipeline_lineage_details(MOCK_FLOWS[0]))

        assert results == []

    def test_yield_pipeline_lineage_details_prefers_asset_lineage_on_cloud(self, prefect_source):
        """On Prefect Cloud, a run with materializations takes priority over
        tag-based lineage — see _yield_lineage_from_assets."""
        pipeline_entity = Mock()
        prefect_source.metadata.get_by_name.return_value = pipeline_entity
        prefect_source.client.get_flow_runs.return_value = [PrefectFlowRun(id="run-1", state_type="COMPLETED")]
        asset_edge = Mock()

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
            patch.object(prefect_source, "_yield_lineage_from_assets", return_value=iter([asset_edge])) as mock_assets,
        ):
            results = list(prefect_source.yield_pipeline_lineage_details(MOCK_FLOWS[0]))

        mock_assets.assert_called_once_with("run-1", pipeline_entity)
        assert results == [asset_edge]

    def test_yield_pipeline_lineage_details_falls_back_to_tags_when_no_materializations(self, prefect_source):
        pipeline_entity = Mock()
        prefect_source.metadata.get_by_name.return_value = pipeline_entity
        prefect_source.client.get_deployments.return_value = []
        prefect_source.client.get_flow_runs.return_value = [PrefectFlowRun(id="run-1", state_type="COMPLETED")]

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
            patch.object(prefect_source, "_yield_lineage_from_assets", return_value=iter([])),
        ):
            results = list(prefect_source.yield_pipeline_lineage_details(MOCK_FLOWS[0]))

        assert results == []

    def test_yield_pipeline_lineage_details_skips_asset_check_when_no_flow_runs(self, prefect_source):
        pipeline_entity = Mock()
        prefect_source.metadata.get_by_name.return_value = pipeline_entity
        prefect_source.client.get_deployments.return_value = []
        prefect_source.client.get_flow_runs.return_value = []

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
        ):
            results = list(prefect_source.yield_pipeline_lineage_details(MOCK_FLOWS[0]))

        assert results == []
        prefect_source.client.get_asset_materializations.assert_not_called()

    def test_yield_pipeline_lineage_details_self_hosted_skips_asset_lineage_entirely(self):
        """Self-hosted Prefect has no Assets API at all — the Cloud-only
        branch must not even check for flow runs."""
        source = _self_hosted_source()
        pipeline_entity = Mock()
        source.metadata.get_by_name.return_value = pipeline_entity
        source.client.get_deployments.return_value = []

        with (
            patch.object(source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect_self_hosted.test-flow",
            ),
        ):
            results = list(source.yield_pipeline_lineage_details(MOCK_FLOWS[0]))

        assert results == []
        source.client.get_flow_runs.assert_not_called()

    def test_yield_pipeline_lineage_details_error_is_a_stack_trace_error(self, prefect_source):
        prefect_source.metadata.get_by_name.side_effect = RuntimeError("boom")

        with (
            patch.object(prefect_source.context, "get", return_value=_context()),
            patch(
                "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
                return_value="test_prefect.test-flow",
            ),
        ):
            results = list(prefect_source.yield_pipeline_lineage_details(MOCK_FLOWS[0]))

        assert len(results) == 1
        assert results[0].right is None
        assert "boom" in results[0].left.error


class TestYieldLineageFromAssets:
    """Cloud-only asset-based lineage: exact per-run upstream/downstream pairs."""

    def test_builds_edge_for_resolved_pair(self, prefect_source):
        pipeline_entity = Mock()
        pipeline_entity.id = Uuid(uuid.uuid4())
        prefect_source.client.get_asset_materializations.return_value = [
            AssetMaterialization(
                asset_key="postgres://host/mydb/public/dest_table",
                upstream_assets=["postgres://host/mydb/public/src_table"],
            )
        ]
        source_table = Mock(id=uuid.uuid4())
        dest_table = Mock(id=uuid.uuid4())

        def resolve_fqn(database, schema, table):
            return {
                ("mydb", "public", "dest_table"): "svc.dest",
                ("mydb", "public", "src_table"): "svc.src",
            }.get((database, schema, table))

        def get_by_name(entity, fqn, **kwargs):
            return {"svc.dest": dest_table, "svc.src": source_table}.get(fqn)

        prefect_source.metadata.get_by_name.side_effect = get_by_name

        with patch.object(prefect_source, "_resolve_table_fqn", side_effect=resolve_fqn):
            results = list(prefect_source._yield_lineage_from_assets("run-1", pipeline_entity))

        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.id.root == source_table.id
        assert edge.toEntity.id.root == dest_table.id
        assert edge.lineageDetails.pipeline.id.root == pipeline_entity.id.root

    def test_yields_nothing_when_no_materializations(self, prefect_source):
        prefect_source.client.get_asset_materializations.return_value = []

        results = list(prefect_source._yield_lineage_from_assets("run-1", Mock()))

        assert results == []

    def test_skips_materialization_when_destination_table_not_found(self, prefect_source):
        pipeline_entity = Mock()
        pipeline_entity.id = Uuid(uuid.uuid4())
        prefect_source.client.get_asset_materializations.return_value = [
            AssetMaterialization(asset_key="postgres://host/mydb/public/dest_table", upstream_assets=[])
        ]

        with patch.object(prefect_source, "_resolve_table_fqn", return_value=None):
            results = list(prefect_source._yield_lineage_from_assets("run-1", pipeline_entity))

        assert results == []

    def test_skips_upstream_asset_when_source_table_not_found(self, prefect_source):
        pipeline_entity = Mock()
        pipeline_entity.id = Uuid(uuid.uuid4())
        dest_table = Mock(id=uuid.uuid4())
        prefect_source.client.get_asset_materializations.return_value = [
            AssetMaterialization(
                asset_key="postgres://host/mydb/public/dest_table",
                upstream_assets=["postgres://host/mydb/public/src_table"],
            )
        ]

        def resolve_fqn(database, schema, table):
            return "svc.dest" if table == "dest_table" else "svc.src"

        def get_by_name(entity, fqn, **kwargs):
            return dest_table if fqn == "svc.dest" else None

        prefect_source.metadata.get_by_name.side_effect = get_by_name

        with patch.object(prefect_source, "_resolve_table_fqn", side_effect=resolve_fqn):
            results = list(prefect_source._yield_lineage_from_assets("run-1", pipeline_entity))

        assert results == []
