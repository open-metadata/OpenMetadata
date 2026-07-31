# #  Copyright 2025 Collate
# #  Licensed under the Collate Community License, Version 1.0 (the "License");
# #  you may not use this file except in compliance with the License.
# #  You may obtain a copy of the License at
# #  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
# #  Unless required by applicable law or agreed to in writing, software
# #  distributed under the License is distributed on an "AS IS" BASIS,
# #  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# #  See the License for the specific language governing permissions and
# #  limitations under the License.
# """
# Unit tests for the Prefect pipeline connector.
# """

# import base64
# import uuid
# from unittest.mock import Mock, patch

# import pytest
# from pydantic import ValidationError

# from metadata.generated.schema.entity.data.pipeline import Pipeline
# from metadata.generated.schema.entity.services.connections.pipeline.prefect.cloudAuth import (
#     PrefectCloudAuthentication,
# )
# from metadata.generated.schema.entity.services.connections.pipeline.prefect.serverAuth import (
#     PrefectServerAuthentication,
# )
# from metadata.generated.schema.entity.services.connections.pipeline.prefectConnection import (
#     PrefectConnection as PrefectConnectionConfig,
# )
# from metadata.generated.schema.metadataIngestion.workflow import (
#     Source as WorkflowSource,
# )
# from metadata.generated.schema.type.entityLineage import Source as LineageSource
# from metadata.generated.schema.type.tagLabel import LabelType, State, TagLabel, TagSource
# from metadata.ingestion.source.pipeline.openlineage.utils import FQNNotFoundException
# from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
# from metadata.ingestion.source.pipeline.prefect.client import (
#     DEPLOYMENTS_PAGE_SIZE,
#     FLOWS_PAGE_SIZE,
#     PrefectClient,
# )
# from metadata.ingestion.source.pipeline.prefect.metadata import PrefectSource

# MOCK_CONFIG = {
#     "source": {
#         "type": "prefect",
#         "serviceName": "test_prefect",
#         "serviceConnection": {
#             "config": {
#                 "type": "Prefect",
#                 "authType": {
#                     "apiKey": "test_key",
#                     "accountId": "test_account",
#                     "workspaceId": "test_workspace",
#                     "hostPort": "https://api.prefect.cloud",
#                 },
#                 "numberOfStatus": 10,
#             }
#         },
#         "sourceConfig": {"config": {"type": "PipelineMetadata"}},
#     }
# }

# MOCK_FLOWS = [
#     {
#         "id": "flow-1",
#         "name": "test-flow",
#         "tags": [
#             "production",
#             "source:db.schema.table1",
#             "destination:db.schema.table2",
#         ],
#     },
#     {
#         "id": "flow-2",
#         "name": "etl-pipeline",
#         "tags": ["etl"],
#     },
# ]

# MOCK_DEPLOYMENTS = [
#     {
#         "id": "dep-1",
#         "flow_id": "flow-1",
#         "name": "test-deployment",
#         "tags": ["nightly"],
#         "schedules": [{"schedule": {"cron": "0 0 * * *", "timezone": "UTC"}, "active": True}],
#     }
# ]

# MOCK_FLOW_RUNS = [
#     {
#         "id": "run-1",
#         "name": "test-run",
#         "state_type": "COMPLETED",
#         "start_time": "2024-04-19T10:00:00Z",
#         "end_time": "2024-04-19T10:05:00Z",
#         "deployment_id": "dep-1",
#     },
#     {
#         "id": "run-2",
#         "name": "test-run-2",
#         "state_type": "FAILED",
#         "start_time": "2024-04-19T11:00:00Z",
#         "end_time": "2024-04-19T11:02:00Z",
#         "deployment_id": None,  # ad-hoc run, not tied to a deployment
#     },
#     {
#         "id": "run-3",
#         "name": "test-run-3",
#         "state_type": "SOME_FUTURE_STATE",
#         "start_time": "2024-04-19T12:00:00Z",
#         "end_time": None,
#     },
# ]


# def _client(auth=None) -> PrefectClient:
#     client = PrefectClient(
#         PrefectConnectionConfig(authType=auth or PrefectServerAuthentication(hostPort="http://localhost:4200"))
#     )
#     client.client = Mock()
#     return client


# @pytest.fixture
# def prefect_source() -> PrefectSource:
#     workflow_source = WorkflowSource.model_validate(MOCK_CONFIG["source"])
#     with patch.object(PipelineServiceSource, "test_connection"):
#         source = PrefectSource(workflow_source, Mock())
#     source.client = Mock(spec=PrefectClient)
#     return source


# def _self_hosted_source() -> PrefectSource:
#     """Self-hosted config with no accountId/workspaceId, hostPort carrying
#     the /api suffix — a documented-valid input (see test_self_hosted_api_suffix_is_not_duplicated)."""
#     config = {
#         "type": "prefect",
#         "serviceName": "test_prefect_self_hosted",
#         "serviceConnection": {
#             "config": {"type": "Prefect", "authType": {"hostPort": "http://localhost:4200/api"}},
#         },
#         "sourceConfig": {"config": {"type": "PipelineMetadata"}},
#     }
#     workflow_source = WorkflowSource.model_validate(config)
#     with patch.object(PipelineServiceSource, "test_connection"):
#         source = PrefectSource(workflow_source, Mock())
#     source.client = Mock(spec=PrefectClient)
#     return source


# def _context(**overrides):
#     defaults = {"pipeline_service": "test_prefect", "pipeline": "test-flow", "task_names": set()}
#     return Mock(**{**defaults, **overrides})


# class TestPrefectClient:
#     """The client owns URL building, filter payloads and pagination."""

#     def test_cloud_path_prefix(self):
#         client = _client(
#             PrefectCloudAuthentication(
#                 apiKey="test_key", accountId="acct", workspaceId="ws", hostPort="https://api.prefect.cloud"
#             )
#         )

#         assert client._path_prefix == "/accounts/acct/workspaces/ws"

#     def test_self_hosted_api_suffix_is_not_duplicated(self):
#         client = PrefectClient(
#             PrefectConnectionConfig(authType=PrefectServerAuthentication(hostPort="http://localhost:4200/api"))
#         )

#         assert client.client.config.base_url == "http://localhost:4200"
#         assert client._path_prefix == ""

#     def test_cloud_auth_requires_all_fields_together(self):
#         """accountId without workspaceId/apiKey/hostPort matches neither the
#         Cloud nor the Server auth schema, so it's rejected at config
#         validation time rather than by a hand-rolled check in the client."""
#         with pytest.raises(ValidationError):
#             PrefectCloudAuthentication(accountId="only-account")

#     def test_no_auth_when_authstring_empty(self):
#         client = PrefectClient(
#             PrefectConnectionConfig(authType=PrefectServerAuthentication(hostPort="http://localhost:4200"))
#         )

#         assert client.client.config.auth_header is None
#         assert client.client.config.auth_token is None

#     def test_bearer_auth_for_cloud(self):
#         client = PrefectClient(
#             PrefectConnectionConfig(
#                 authType=PrefectCloudAuthentication(
#                     apiKey="test_key", accountId="acct", workspaceId="ws", hostPort="https://api.prefect.cloud"
#                 )
#             )
#         )

#         assert client.client.config.auth_header == "Authorization"
#         assert client.client.config.auth_token_mode == "Bearer"
#         assert client.client.config.auth_token()[0] == "test_key"

#     def test_basic_auth_when_authstring_set(self):
#         client = PrefectClient(
#             PrefectConnectionConfig(
#                 authType=PrefectServerAuthentication(hostPort="http://localhost:4200", authString="admin:secret")
#             )
#         )

#         assert client.client.config.auth_header == "Authorization"
#         assert client.client.config.auth_token_mode == "Basic"
#         assert client.client.config.auth_token()[0] == base64.b64encode(b"admin:secret").decode()

#     def test_flow_runs_filter_targets_the_flow(self):
#         client = _client()
#         client.client.post.return_value = MOCK_FLOW_RUNS

#         runs = client.get_flow_runs("flow-1", limit=10)

#         assert runs == MOCK_FLOW_RUNS
#         payload = client.client.post.call_args.kwargs["json"]
#         assert payload["flows"] == {"id": {"any_": ["flow-1"]}}
#         assert payload["limit"] == 10

#     def test_deployments_filter_targets_the_flow_and_paginates(self):
#         client = _client()
#         full_page = [{"id": f"dep-{index}"} for index in range(DEPLOYMENTS_PAGE_SIZE)]
#         client.client.post.side_effect = [full_page, [{"id": "dep-last"}]]

#         deployments = client.get_deployments("flow-1")

#         assert len(deployments) == DEPLOYMENTS_PAGE_SIZE + 1
#         first_call, second_call = client.client.post.call_args_list
#         assert first_call.kwargs["json"]["flows"] == {"id": {"any_": ["flow-1"]}}
#         assert first_call.kwargs["json"]["offset"] == 0
#         assert second_call.kwargs["json"]["offset"] == DEPLOYMENTS_PAGE_SIZE

#     def test_task_runs_filter_targets_the_run_and_paginates(self):
#         client = _client()
#         full_page = [{"id": f"tr-{index}", "flow_run_id": "run-1"} for index in range(200)]
#         client.client.post.side_effect = [full_page, [{"id": "tr-last", "flow_run_id": "run-1"}]]

#         task_runs = client.get_task_runs("run-1")

#         assert len(task_runs) == 201
#         first_call, second_call = client.client.post.call_args_list
#         assert first_call.kwargs["json"]["task_runs"] == {"flow_run_id": {"any_": ["run-1"]}}
#         assert first_call.kwargs["json"]["offset"] == 0
#         assert second_call.kwargs["json"]["offset"] == 200

#     def test_flows_pagination_advances_offset(self):
#         client = _client()
#         full_page = [{"id": f"flow-{index}"} for index in range(FLOWS_PAGE_SIZE)]
#         client.client.post.side_effect = [full_page, []]

#         flows = list(client.get_flows())

#         assert len(flows) == FLOWS_PAGE_SIZE
#         second_call = client.client.post.call_args_list[1]
#         assert second_call.kwargs["json"]["offset"] == FLOWS_PAGE_SIZE


# class TestPrefectSource:
#     """The source turns client payloads into OpenMetadata requests."""

#     def test_get_pipelines_list(self, prefect_source):
#         prefect_source.client.get_flows.return_value = iter(MOCK_FLOWS)

#         assert list(prefect_source.get_pipelines_list()) == MOCK_FLOWS

#     def test_get_pipeline_name(self, prefect_source):
#         assert prefect_source.get_pipeline_name(MOCK_FLOWS[0]) == "test-flow"

#     def test_yield_pipeline_registers_the_record(self, prefect_source):
#         """Regression test: a flow that isn't registered gets marked deleted on
#         the next run when markDeletedPipelines is on (the mass-deletion bug)."""
#         prefect_source.client.get_deployments.return_value = MOCK_DEPLOYMENTS
#         prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
#         prefect_source.client.get_task_runs.return_value = [{"id": "tr-1", "name": "extract", "task_inputs": {}}]
#         stub_tags = [
#             TagLabel(
#                 tagFQN="PrefectTags.production",
#                 source=TagSource.Classification,
#                 labelType=LabelType.Automated,
#                 state=State.Suggested,
#             )
#         ]

#         with (
#             patch.object(prefect_source.context, "get", return_value=_context()),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels",
#                 return_value=stub_tags,
#             ),
#             patch.object(prefect_source, "register_record") as mock_register,
#         ):
#             results = list(prefect_source.yield_pipeline(MOCK_FLOWS[0]))

#         assert len(results) == 1
#         request = results[0].right
#         assert request is not None
#         assert request.name.root == "test-flow"
#         assert len(request.tasks) == 1
#         assert request.tasks[0].name == "extract"
#         assert request.tags == stub_tags
#         mock_register.assert_called_once_with(pipeline_request=request)

#     def test_yield_pipeline_error_is_a_stack_trace_error(self, prefect_source):
#         """Either.left must be a StackTraceError, not a raw exception, or
#         Pydantic validation on the Either itself blows up."""
#         prefect_source.client.get_deployments.side_effect = RuntimeError("boom")

#         results = list(prefect_source.yield_pipeline(MOCK_FLOWS[0]))

#         assert len(results) == 1
#         assert results[0].right is None
#         assert results[0].left is not None
#         assert "boom" in results[0].left.error

#     def test_yield_pipeline_self_hosted_source_url_strips_api_suffix(self):
#         """hostPort may carry /api (the client strips it for API calls too,
#         see test_self_hosted_api_suffix_is_not_duplicated) — the Prefect UI
#         itself is served without it, so a dead link would result otherwise."""
#         source = _self_hosted_source()
#         source.client.get_deployments.return_value = []
#         source.client.get_flow_runs.return_value = []
#         source.client.get_task_runs.return_value = []

#         with (
#             patch.object(source.context, "get", return_value=_context()),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels",
#                 return_value=None,
#             ),
#         ):
#             results = list(source.yield_pipeline(MOCK_FLOWS[1]))

#         assert len(results) == 1
#         assert results[0].right.sourceUrl.root == "http://localhost:4200/flows/flow/flow-2"

#     def test_yield_tag_delegates_to_tag_utils(self, prefect_source):
#         prefect_source.client.get_deployments.return_value = MOCK_DEPLOYMENTS
#         prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
#         prefect_source.client.get_task_runs.return_value = [{"id": "tr-1", "name": "extract", "tags": ["urgent"]}]

#         with patch(
#             "metadata.ingestion.source.pipeline.prefect.metadata.get_ometa_tag_and_classification",
#             return_value=iter(["stub-tag"]),
#         ) as mock_get_tags:
#             results = list(prefect_source.yield_tag(MOCK_FLOWS[0]))

#         assert results == ["stub-tag"]
#         _, kwargs = mock_get_tags.call_args
#         assert set(kwargs["tags"]) == {
#             "production",
#             "source:db.schema.table1",
#             "destination:db.schema.table2",
#             "nightly",
#             "urgent",
#         }
#         assert kwargs["classification_name"] == "PrefectTags"

#     def test_yield_tag_skips_task_fetch_when_flow_never_ran(self, prefect_source):
#         """No flow runs yet means no task runs to fetch, not a crash."""
#         prefect_source.client.get_deployments.return_value = []
#         prefect_source.client.get_flow_runs.return_value = []

#         with patch(
#             "metadata.ingestion.source.pipeline.prefect.metadata.get_ometa_tag_and_classification",
#             return_value=iter([]),
#         ):
#             list(prefect_source.yield_tag(MOCK_FLOWS[0]))

#         prefect_source.client.get_task_runs.assert_not_called()

#     def test_build_task_dag_resolves_task_level_tags(self, prefect_source):
#         """Each Task's own tags are resolved into TagLabels via the same
#         PrefectTags classification used for pipeline-level tags."""
#         task_runs = [
#             {"id": "tr-1", "name": "extract", "tags": ["urgent", "pii"]},
#             {"id": "tr-2", "name": "load", "tags": []},
#         ]

#         with patch(
#             "metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels",
#             return_value=None,
#         ) as mock_get_tag_labels:
#             prefect_source._build_task_dag(task_runs)

#         assert len(mock_get_tag_labels.call_args_list) == 2
#         assert set(mock_get_tag_labels.call_args_list[0].kwargs["tags"]) == {"urgent", "pii"}
#         assert mock_get_tag_labels.call_args_list[1].kwargs["tags"] == []
#         for call in mock_get_tag_labels.call_args_list:
#             assert call.kwargs["classification_name"] == "PrefectTags"

#     def test_yield_pipeline_status_wraps_in_ometa_pipeline_status(self, prefect_source):
#         prefect_source.client.get_flow_runs.return_value = MOCK_FLOW_RUNS
#         prefect_source.client.get_task_runs.return_value = []

#         with (
#             patch.object(prefect_source.context, "get", return_value=_context()),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
#                 return_value="test_prefect.test-flow",
#             ),
#         ):
#             results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

#         assert len(results) == 3
#         for result in results:
#             assert result.right is not None
#             assert result.right.pipeline_fqn == "test_prefect.test-flow"

#         assert results[0].right.pipeline_status.executionStatus.value == "Successful"
#         assert results[1].right.pipeline_status.executionStatus.value == "Failed"
#         # An unrecognized state defaults to Pending, not Failed
#         assert results[2].right.pipeline_status.executionStatus.value == "Pending"

#     def test_yield_pipeline_status_nests_real_task_statuses_per_run(self, prefect_source):
#         """Each PipelineStatus entry nests that specific flow run's own real
#         task runs — not a stand-in derived from the deployment name."""
#         prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
#         prefect_source.client.get_task_runs.return_value = [
#             {
#                 "id": "tr-1",
#                 "name": "extract",
#                 "state_type": "COMPLETED",
#                 "start_time": "2024-04-19T10:00:00Z",
#                 "end_time": "2024-04-19T10:01:00Z",
#             }
#         ]

#         with (
#             patch.object(prefect_source.context, "get", return_value=_context(task_names={"extract"})),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
#                 return_value="test_prefect.test-flow",
#             ),
#         ):
#             results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

#         prefect_source.client.get_task_runs.assert_called_once_with("run-1")
#         task_status = results[0].right.pipeline_status.taskStatus
#         assert len(task_status) == 1
#         assert task_status[0].name == "extract"
#         assert task_status[0].executionStatus.value == "Successful"

#     def test_yield_pipeline_status_drops_task_status_not_on_current_pipeline(self, prefect_source):
#         """The server rejects a taskStatus name absent from Pipeline.tasks
#         (validateTask, PipelineRepository.java) — a run with a task the
#         current pipeline no longer has (renamed/removed since) must have
#         that entry dropped, not sent, same as the Airflow connector does."""
#         prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
#         prefect_source.client.get_task_runs.return_value = [
#             {"id": "tr-1", "name": "extract", "state_type": "COMPLETED", "start_time": "2024-04-19T10:00:00Z"},
#             {"id": "tr-2", "name": "transform", "state_type": "COMPLETED", "start_time": "2024-04-19T10:00:00Z"},
#         ]

#         with (
#             patch.object(prefect_source.context, "get", return_value=_context(task_names={"extract"})),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
#                 return_value="test_prefect.test-flow",
#             ),
#         ):
#             results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

#         task_status = results[0].right.pipeline_status.taskStatus
#         assert [t.name for t in task_status] == ["extract"]

#     def test_yield_pipeline_stashes_task_names_for_status_step(self, prefect_source):
#         """yield_pipeline_status reads context.task_names back instead of
#         re-fetching the latest run — mirrors the Airflow connector's pattern."""
#         prefect_source.client.get_deployments.return_value = []
#         prefect_source.client.get_flow_runs.return_value = [MOCK_FLOW_RUNS[0]]
#         prefect_source.client.get_task_runs.return_value = [{"id": "tr-1", "name": "extract", "task_inputs": {}}]
#         context = _context()

#         with (
#             patch.object(prefect_source.context, "get", return_value=context),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.get_tag_labels",
#                 return_value=None,
#             ),
#         ):
#             list(prefect_source.yield_pipeline(MOCK_FLOWS[0]))

#         assert context.task_names == {"extract"}

#     def test_yield_pipeline_stashes_empty_task_names_on_failure(self, prefect_source):
#         """A flow that fails in yield_pipeline must still leave task_names
#         set (to empty) so yield_pipeline_status doesn't crash reading it."""
#         prefect_source.client.get_deployments.side_effect = RuntimeError("boom")
#         context = _context(task_names=Mock())  # anything non-empty/unset beforehand

#         with patch.object(prefect_source.context, "get", return_value=context):
#             list(prefect_source.yield_pipeline(MOCK_FLOWS[0]))

#         assert context.task_names == set()

#     def test_yield_pipeline_status_skips_runs_without_a_timestamp(self, prefect_source):
#         """PipelineStatus.timestamp is a required field — a run with neither
#         start_time nor expected_start_time can't produce one and must be
#         skipped, not raise (which would previously drop every status)."""
#         no_timestamp_run = {"id": "run-x", "state_type": "PENDING", "start_time": None, "end_time": None}
#         prefect_source.client.get_flow_runs.return_value = [no_timestamp_run, MOCK_FLOW_RUNS[0]]
#         prefect_source.client.get_task_runs.return_value = []

#         with (
#             patch.object(prefect_source.context, "get", return_value=_context()),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
#                 return_value="test_prefect.test-flow",
#             ),
#         ):
#             results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

#         assert len(results) == 1
#         assert results[0].right.pipeline_status.executionStatus.value == "Successful"

#     def test_yield_pipeline_status_error_is_a_stack_trace_error(self, prefect_source):
#         prefect_source.client.get_flow_runs.side_effect = RuntimeError("boom")

#         results = list(prefect_source.yield_pipeline_status(MOCK_FLOWS[0]))

#         assert len(results) == 1
#         assert results[0].right is None
#         assert "boom" in results[0].left.error

#     def test_parse_lineage_from_tags_preserves_case(self, prefect_source):
#         tags = [
#             "production",
#             "OM-SOURCE:MySQL.Sales.Orders",
#             "om-destination:mysql.analytics.SUMMARY",
#             "source:legacy.Schema.Table",
#             "etl",
#         ]

#         sources, destinations = prefect_source._parse_lineage_from_tags(tags)

#         assert sources == ["MySQL.Sales.Orders", "legacy.Schema.Table"]
#         assert destinations == ["mysql.analytics.SUMMARY"]

#     def test_schedule_interval_reads_cron_from_schedules_list(self, prefect_source):
#         """Prefect 3.x deployments use a `schedules` list, not a singular
#         `schedule` field — this must read the real shape."""
#         assert prefect_source._schedule_interval(MOCK_DEPLOYMENTS) == "0 0 * * *"

#     def test_schedule_interval_skips_inactive_and_reads_interval(self, prefect_source):
#         deployments = [
#             {
#                 "schedules": [
#                     {"schedule": {"cron": "0 0 * * *"}, "active": False},
#                     {"schedule": {"interval": 3600}, "active": True},
#                 ]
#             }
#         ]

#         assert prefect_source._schedule_interval(deployments) == "every 3600s"

#     def test_schedule_interval_none_when_no_deployments_or_schedules(self, prefect_source):
#         assert prefect_source._schedule_interval([]) is None
#         assert prefect_source._schedule_interval([{"schedules": []}]) is None

#     def test_get_all_tags_merges_flow_and_deployment_tags(self, prefect_source):
#         flow = {"tags": ["flow-tag1", "flow-tag2"]}
#         deployments = [{"tags": ["dep-tag1"]}, {"tags": ["dep-tag2", "flow-tag1"]}]

#         all_tags = prefect_source._get_all_tags(flow, deployments)

#         assert sorted(all_tags) == ["dep-tag1", "dep-tag2", "flow-tag1", "flow-tag2"]

#     def test_resolve_table_fqn_uses_the_base_helper(self, prefect_source):
#         with patch.object(
#             prefect_source,
#             "_get_table_fqn_from_om",
#             return_value="service.mysql.sales.orders",
#         ) as mock_resolve:
#             result = prefect_source._resolve_table_fqn("mysql.sales.orders")

#         assert result == "service.mysql.sales.orders"
#         table_details = mock_resolve.call_args.args[0]
#         assert (table_details.database, table_details.schema, table_details.name) == (
#             "mysql",
#             "sales",
#             "orders",
#         )

#     def test_resolve_table_fqn_rejects_malformed_identifier(self, prefect_source):
#         assert prefect_source._resolve_table_fqn("not-enough-parts") is None

#     def test_resolve_table_fqn_returns_none_when_not_found(self, prefect_source):
#         with patch.object(
#             prefect_source,
#             "_get_table_fqn_from_om",
#             side_effect=FQNNotFoundException("not found"),
#         ):
#             assert prefect_source._resolve_table_fqn("mysql.sales.orders") is None

#     def test_yield_pipeline_lineage_details_builds_table_to_table_edges(self, prefect_source):
#         flow = {"id": "flow-1", "name": "test-flow"}

#         pipeline_entity = Mock()
#         pipeline_entity.id.root = uuid.uuid4()
#         source_tag = Mock()
#         source_tag.name = "om-source:mysql.sales.orders"
#         dest_tag = Mock()
#         dest_tag.name = "om-destination:mysql.analytics.summary"
#         pipeline_entity.tags = [source_tag, dest_tag]
#         source_table = Mock(id=uuid.uuid4())
#         dest_table = Mock(id=uuid.uuid4())

#         def get_by_name(entity, fqn, **kwargs):
#             if entity is Pipeline:
#                 return pipeline_entity
#             return {
#                 "svc.mysql.sales.orders": source_table,
#                 "svc.mysql.analytics.summary": dest_table,
#             }.get(fqn)

#         prefect_source.metadata.get_by_name.side_effect = get_by_name

#         with (
#             patch.object(prefect_source.context, "get", return_value=_context()),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
#                 return_value="test_prefect.test-flow",
#             ),
#             patch.object(
#                 prefect_source,
#                 "_resolve_table_fqn",
#                 side_effect=lambda identifier: {
#                     "mysql.sales.orders": "svc.mysql.sales.orders",
#                     "mysql.analytics.summary": "svc.mysql.analytics.summary",
#                 }[identifier],
#             ),
#         ):
#             results = list(prefect_source.yield_pipeline_lineage_details(flow))

#         assert len(results) == 1
#         edge = results[0].right.edge
#         assert edge.fromEntity.id.root == source_table.id
#         assert edge.fromEntity.type == "table"
#         assert edge.toEntity.id.root == dest_table.id
#         assert edge.toEntity.type == "table"
#         assert edge.lineageDetails.source == LineageSource.PipelineLineage
#         assert edge.lineageDetails.pipeline.id.root == pipeline_entity.id.root

#     def test_yield_pipeline_lineage_details_skips_when_only_one_side_present(self, prefect_source):
#         pipeline_entity = Mock()
#         tag = Mock()
#         tag.name = "om-source:mysql.sales.orders"
#         pipeline_entity.tags = [tag]
#         prefect_source.metadata.get_by_name.return_value = pipeline_entity

#         with (
#             patch.object(prefect_source.context, "get", return_value=_context()),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
#                 return_value="test_prefect.test-flow",
#             ),
#         ):
#             results = list(prefect_source.yield_pipeline_lineage_details({"id": "flow-1", "name": "test-flow"}))

#         assert results == []

#     def test_yield_pipeline_lineage_details_returns_when_pipeline_not_found(self, prefect_source):
#         prefect_source.metadata.get_by_name.return_value = None

#         with (
#             patch.object(prefect_source.context, "get", return_value=_context()),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
#                 return_value="test_prefect.test-flow",
#             ),
#         ):
#             results = list(prefect_source.yield_pipeline_lineage_details({"id": "flow-1", "name": "test-flow"}))

#         assert results == []

#     def test_yield_pipeline_lineage_details_ignores_tags_without_a_name(self, prefect_source):
#         """Locally-built TagLabels never set .name (see get_tag_label) — only
#         server-hydrated ones do (TagLabelUtil.setName). A None here must not
#         crash tag.strip() in _parse_lineage_from_tags."""
#         pipeline_entity = Mock()
#         unnamed_tag = Mock()
#         unnamed_tag.name = None
#         pipeline_entity.tags = [unnamed_tag]
#         prefect_source.metadata.get_by_name.return_value = pipeline_entity

#         with (
#             patch.object(prefect_source.context, "get", return_value=_context()),
#             patch(
#                 "metadata.ingestion.source.pipeline.prefect.metadata.fqn.build",
#                 return_value="test_prefect.test-flow",
#             ),
#         ):
#             results = list(prefect_source.yield_pipeline_lineage_details({"id": "flow-1", "name": "test-flow"}))

#         assert results == []
