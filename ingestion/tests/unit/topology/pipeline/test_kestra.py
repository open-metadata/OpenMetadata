#  Copyright 2025 Collate
#  Licensed under the Collate License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Unit tests for the Kestra pipeline connector.

Tests cover:
  - get_pipeline_name
  - yield_pipeline field mapping
  - yield_pipeline_status state mapping (all 10 states + unknown)
  - yield_pipeline_lineage_details (valid labels, unresolvable labels)
  - round-trip name consistency
"""
import uuid

import pytest
from unittest.mock import MagicMock

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.kestra.metadata import (
    KESTRA_STATUS_MAP,
    KestraSource,
)
from metadata.ingestion.source.pipeline.kestra.models import (
    KestraExecution,
    KestraExecutionState,
    KestraFlow,
    KestraLabel,
    KestraTask,
)

# ---------------------------------------------------------------------------
# Sample flows
# ---------------------------------------------------------------------------

MOCK_FLOW = KestraFlow(
    id="my-flow",
    namespace="company.team",
    description="A test flow",
    tasks=[
        KestraTask(id="task-1", type="io.kestra.core.tasks.log.Log"),
        KestraTask(id="task-2", type="io.kestra.core.tasks.scripts.Python"),
    ],
)

MOCK_FLOW_WITH_LINEAGE = KestraFlow(
    id="lineage-flow",
    namespace="company.team",
    labels=[
        KestraLabel(key="openmetadata.table.input", value="mysql_service.db.schema.source_table"),
        KestraLabel(key="openmetadata.table.output", value="postgres_service.db.schema.dest_table"),
    ],
)

MOCK_FLOW_NO_LABELS = KestraFlow(
    id="no-label-flow",
    namespace="company.team",
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def source():
    s = KestraSource.__new__(KestraSource)
    s.client = MagicMock()
    s.metadata = MagicMock()
    s.service_connection = MagicMock()
    s.service_connection.hostPort = "http://localhost:8080"
    s.source_config = MagicMock()
    s.source_config.markDeletedPipelines = False
    s.pipeline_source_state = set()
    s.context = MagicMock()
    ctx = MagicMock()
    ctx.pipeline_service = "kestra_test"
    ctx.pipeline = "company.team.my-flow"
    s.context.get.return_value = ctx
    return s


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestKestraSource:

    # -----------------------------------------------------------------------
    # get_pipeline_name
    # -----------------------------------------------------------------------

    def test_get_pipeline_name(self, source):
        flow = KestraFlow(id="my-flow", namespace="company.team")
        assert source.get_pipeline_name(flow) == "company.team.my-flow"

    def test_get_pipeline_name_nested_namespace(self, source):
        flow = KestraFlow(id="etl", namespace="org.data.team.project")
        assert source.get_pipeline_name(flow) == "org.data.team.project.etl"

    # -----------------------------------------------------------------------
    # yield_pipeline field mapping
    # -----------------------------------------------------------------------

    def test_yield_pipeline_fields(self, source):
        results = list(source.yield_pipeline(MOCK_FLOW))
        assert len(results) == 1
        req: CreatePipelineRequest = results[0].right
        assert req is not None, f"yield_pipeline error: {results[0].left}"
        assert req.name.root == "company.team.my-flow"
        assert req.displayName == "my-flow"
        assert req.description.root == "A test flow"
        assert req.sourceUrl.root == (
            "http://localhost:8080/ui/company.team/flows/edit/my-flow"
        )

    def test_yield_pipeline_tasks(self, source):
        results = list(source.yield_pipeline(MOCK_FLOW))
        req: CreatePipelineRequest = results[0].right
        assert req.tasks is not None
        assert len(req.tasks) == 2
        task_names = [t.name if isinstance(t.name, str) else t.name.root for t in req.tasks]
        assert "task-1" in task_names
        assert "task-2" in task_names

    def test_yield_pipeline_task_type(self, source):
        results = list(source.yield_pipeline(MOCK_FLOW))
        req: CreatePipelineRequest = results[0].right
        task_map = {
            (t.name if isinstance(t.name, str) else t.name.root): t
            for t in req.tasks
        }
        assert task_map["task-1"].taskType == "io.kestra.core.tasks.log.Log"
        assert task_map["task-2"].taskType == "io.kestra.core.tasks.scripts.Python"

    def test_yield_pipeline_no_tasks(self, source):
        flow = KestraFlow(id="empty-flow", namespace="ns")
        results = list(source.yield_pipeline(flow))
        req: CreatePipelineRequest = results[0].right
        assert req.tasks is None

    # -----------------------------------------------------------------------
    # yield_pipeline_status state mapping
    # -----------------------------------------------------------------------

    def _make_execution(self, state: str) -> KestraExecution:
        return KestraExecution(
            id=f"exec-{state}",
            namespace="company.team",
            flowId="my-flow",
            state=KestraExecutionState(current=state),
            startDate="2024-01-15T10:00:00+00:00",
        )

    def _assert_status(self, source, state: str, expected: StatusType):
        source.client.get_executions.return_value = [self._make_execution(state)]
        results = list(source.yield_pipeline_status(MOCK_FLOW))
        assert results, f"No results yielded for state '{state}'"
        actual = results[0].right.pipeline_status.executionStatus
        actual_val = actual.value if isinstance(actual, StatusType) else actual
        assert actual_val == expected.value, (
            f"State '{state}': expected {expected.value!r}, got {actual_val!r}"
        )

    def test_status_map_success(self, source):
        self._assert_status(source, "SUCCESS", StatusType.Successful)

    def test_status_map_failed(self, source):
        self._assert_status(source, "FAILED", StatusType.Failed)

    def test_status_map_killed(self, source):
        self._assert_status(source, "KILLED", StatusType.Failed)

    def test_status_map_running(self, source):
        self._assert_status(source, "RUNNING", StatusType.Pending)

    def test_status_map_created(self, source):
        self._assert_status(source, "CREATED", StatusType.Pending)

    def test_status_map_unknown_defaults_to_pending(self, source):
        self._assert_status(source, "SOME_FUTURE_STATE", StatusType.Pending)

    def test_status_map_warning_is_successful(self, source):
        self._assert_status(source, "WARNING", StatusType.Successful)

    def test_status_map_all_defined_states(self, source):
        expected_states = {
            "SUCCESS", "FAILED", "KILLED", "RUNNING", "CREATED",
            "PAUSED", "QUEUED", "RESTARTED", "KILLING", "WARNING",
        }
        assert expected_states == set(KESTRA_STATUS_MAP.keys())

    def test_yield_pipeline_status_includes_end_time(self, source):
        execution = KestraExecution(
            id="exec-1",
            namespace="company.team",
            flowId="my-flow",
            state=KestraExecutionState(current="SUCCESS"),
            startDate="2024-01-15T10:00:00+00:00",
            endDate="2024-01-15T10:05:00+00:00",
        )
        source.client.get_executions.return_value = [execution]
        results = list(source.yield_pipeline_status(MOCK_FLOW))
        assert len(results) == 1
        status = results[0].right.pipeline_status
        assert status.taskStatus[0].endTime is not None
        assert status.endTime is not None

    def test_yield_pipeline_status_no_end_date(self, source):
        execution = KestraExecution(
            id="exec-1",
            namespace="company.team",
            flowId="my-flow",
            state=KestraExecutionState(current="RUNNING"),
            startDate="2024-01-15T10:00:00+00:00",
            endDate=None,
        )
        source.client.get_executions.return_value = [execution]
        results = list(source.yield_pipeline_status(MOCK_FLOW))
        assert results[0].right.pipeline_status.taskStatus[0].endTime is None

    # -----------------------------------------------------------------------
    # yield_pipeline_lineage_details — valid labels
    # -----------------------------------------------------------------------

    def _make_table_entity(self, fqn_str: str) -> Table:
        t = MagicMock(spec=Table)
        t.id = MagicMock()
        t.id.root = str(uuid.uuid4())
        t.fullyQualifiedName = MagicMock()
        t.fullyQualifiedName.root = fqn_str
        return t

    def test_lineage_input_label(self, source):
        flow = KestraFlow(
            id="flow-in",
            namespace="ns",
            labels=[KestraLabel(key="openmetadata.table.input", value="svc.db.schema.tbl")],
        )
        mock_table = self._make_table_entity("svc.db.schema.tbl")
        mock_pipeline = MagicMock(spec=Pipeline)
        mock_pipeline.id = MagicMock()
        mock_pipeline.id.root = str(uuid.uuid4())

        source.metadata.get_by_name.side_effect = lambda entity, fqn: (
            mock_pipeline if entity == Pipeline else mock_table
        )

        results = [r for r in source.yield_pipeline_lineage_details(flow) if r.right]
        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.type == "table"
        assert edge.toEntity.type == "pipeline"

    def test_lineage_output_label(self, source):
        flow = KestraFlow(
            id="flow-out",
            namespace="ns",
            labels=[KestraLabel(key="openmetadata.table.output", value="svc.db.schema.tbl")],
        )
        mock_table = self._make_table_entity("svc.db.schema.tbl")
        mock_pipeline = MagicMock(spec=Pipeline)
        mock_pipeline.id = MagicMock()
        mock_pipeline.id.root = str(uuid.uuid4())

        source.metadata.get_by_name.side_effect = lambda entity, fqn: (
            mock_pipeline if entity == Pipeline else mock_table
        )

        results = [r for r in source.yield_pipeline_lineage_details(flow) if r.right]
        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.type == "pipeline"
        assert edge.toEntity.type == "table"

    def test_lineage_exception_yields_error(self, source):
        flow = KestraFlow(
            id="flow",
            namespace="ns",
            labels=[KestraLabel(key="openmetadata.table.input", value="svc.db.schema.tbl")],
        )
        source.metadata.get_by_name.side_effect = RuntimeError("API down")
        results = list(source.yield_pipeline_lineage_details(flow))
        assert len(results) == 1
        assert results[0].left is not None
        assert "API down" in results[0].left.error

    # -----------------------------------------------------------------------
    # yield_pipeline_lineage_details — unresolvable labels
    # -----------------------------------------------------------------------

    def test_lineage_unresolvable_input(self, source):
        flow = KestraFlow(
            id="flow-bad",
            namespace="ns",
            labels=[KestraLabel(key="openmetadata.table.input", value="nonexistent.table")],
        )
        mock_pipeline = MagicMock(spec=Pipeline)
        mock_pipeline.id = MagicMock()
        mock_pipeline.id.root = str(uuid.uuid4())

        source.metadata.get_by_name.side_effect = lambda entity, fqn: (
            mock_pipeline if entity == Pipeline else None
        )

        results = [r for r in source.yield_pipeline_lineage_details(flow) if r.right]
        assert len(results) == 0

    def test_lineage_no_labels(self, source):
        results = list(source.yield_pipeline_lineage_details(MOCK_FLOW_NO_LABELS))
        assert len(results) == 0

    # -----------------------------------------------------------------------
    # round-trip name consistency
    # -----------------------------------------------------------------------

    def test_round_trip_name_consistency(self, source):
        test_cases = [
            KestraFlow(id="flow-a", namespace="ns1"),
            KestraFlow(id="etl-job", namespace="company.data.team"),
            KestraFlow(id="my_pipeline", namespace="prod"),
            KestraFlow(id="123", namespace="a.b.c.d"),
        ]
        for flow in test_cases:
            expected = f"{flow.namespace}.{flow.id}"
            assert source.get_pipeline_name(flow) == expected, (
                f"Mismatch for flow {flow.namespace}/{flow.id}"
            )
