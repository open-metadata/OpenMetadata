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
from unittest import TestCase
from unittest.mock import MagicMock, patch

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
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
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
    KestraTask,
)

# ---------------------------------------------------------------------------
# Shared mock config
# ---------------------------------------------------------------------------

MOCK_KESTRA_CONFIG = {
    "source": {
        "type": "kestra",
        "serviceName": "kestra_test",
        "serviceConnection": {
            "config": {
                "type": "Kestra",
                "hostPort": "http://localhost:8080",
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
                "jwtToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test"
            },
        }
    },
}

MOCK_PIPELINE_SERVICE = PipelineService(
    id=str(uuid.uuid4()),
    name="kestra_test",
    fullyQualifiedName=FullyQualifiedEntityName("kestra_test"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Kestra,
)

MOCK_PIPELINE = Pipeline(
    id=str(uuid.uuid4()),
    name="company.team.my-flow",
    fullyQualifiedName="kestra_test.company.team.my-flow",
    displayName="my-flow",
    service=EntityReference(id=str(uuid.uuid4()), type="pipelineService"),
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
    labels={
        "openmetadata.table.input": "mysql_service.db.schema.source_table",
        "openmetadata.table.output": "postgres_service.db.schema.dest_table",
    },
)

MOCK_FLOW_NO_LABELS = KestraFlow(
    id="no-label-flow",
    namespace="company.team",
)


# ---------------------------------------------------------------------------
# Test class
# ---------------------------------------------------------------------------


class TestKestraSource(TestCase):
    """Unit tests for KestraSource."""

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch(
        "metadata.ingestion.source.pipeline.kestra.metadata.KestraSource.__init__",
        lambda self, config, metadata: None,
    )
    def setUp(self, _test_connection):
        """
        Build a KestraSource with all external calls mocked out.
        We bypass __init__ entirely and set attributes manually so we can
        test individual methods in isolation.
        """
        _test_connection.return_value = None

        with patch(
            "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
        ):
            config = OpenMetadataWorkflowConfig.model_validate(MOCK_KESTRA_CONFIG)

            with patch(
                "metadata.ingestion.source.pipeline.kestra.connection.get_connection"
            ):
                with patch(
                    "metadata.ingestion.source.pipeline.kestra.metadata.KestraSource.test_connection"
                ):
                    self.source = KestraSource.__new__(KestraSource)
                    # Manually wire the attributes the methods depend on
                    self.source.client = MagicMock()
                    self.source.metadata = MagicMock()
                    self.source.service_connection = MagicMock()
                    self.source.service_connection.hostPort = "http://localhost:8080"
                    self.source.source_config = MagicMock()
                    self.source.source_config.markDeletedPipelines = False
                    self.source.pipeline_source_state = set()
                    self.source.context = MagicMock()
                    ctx = MagicMock()
                    ctx.pipeline_service = "kestra_test"
                    ctx.pipeline = "company.team.my-flow"
                    self.source.context.get.return_value = ctx

    # -----------------------------------------------------------------------
    # 9.2 — get_pipeline_name
    # -----------------------------------------------------------------------

    def test_get_pipeline_name(self):
        """get_pipeline_name returns '{namespace}.{flow_id}'."""
        flow = KestraFlow(id="my-flow", namespace="company.team")
        assert self.source.get_pipeline_name(flow) == "company.team.my-flow"

    def test_get_pipeline_name_nested_namespace(self):
        """Works with deeply nested namespaces."""
        flow = KestraFlow(id="etl", namespace="org.data.team.project")
        assert self.source.get_pipeline_name(flow) == "org.data.team.project.etl"

    # -----------------------------------------------------------------------
    # 9.3 — yield_pipeline field mapping
    # -----------------------------------------------------------------------

    def test_yield_pipeline_fields(self):
        """yield_pipeline produces a CreatePipelineRequest with correct fields."""
        results = list(self.source.yield_pipeline(MOCK_FLOW))
        assert len(results) == 1
        req: CreatePipelineRequest = results[0].right
        assert req is not None, f"yield_pipeline error: {results[0].left}"
        assert req.name.root == "company.team.my-flow"
        assert req.displayName == "my-flow"
        assert req.description.root == "A test flow"
        assert req.sourceUrl.root == (
            "http://localhost:8080/ui/company.team/flows/edit/my-flow"
        )

    def test_yield_pipeline_tasks(self):
        """yield_pipeline maps KestraTask list to Task list correctly."""
        results = list(self.source.yield_pipeline(MOCK_FLOW))
        req: CreatePipelineRequest = results[0].right
        assert req.tasks is not None
        assert len(req.tasks) == 2
        task_names = [t.name if isinstance(t.name, str) else t.name.root for t in req.tasks]
        assert "task-1" in task_names
        assert "task-2" in task_names

    def test_yield_pipeline_no_tasks(self):
        """yield_pipeline handles flows with no tasks gracefully."""
        flow = KestraFlow(id="empty-flow", namespace="ns")
        results = list(self.source.yield_pipeline(flow))
        req: CreatePipelineRequest = results[0].right
        assert req.tasks is None

    # -----------------------------------------------------------------------
    # 9.4 — yield_pipeline_status state mapping
    # -----------------------------------------------------------------------

    def _make_execution(self, state: str) -> KestraExecution:
        return KestraExecution(
            id=f"exec-{state}",
            namespace="company.team",
            flowId="my-flow",
            state=KestraExecutionState(current=state),
            startDate="2024-01-15T10:00:00+00:00",
        )

    def _assert_status(self, state: str, expected: StatusType):
        """Helper: run yield_pipeline_status for a single execution and check status."""
        self.source.client.get_executions.return_value = [self._make_execution(state)]
        results = list(self.source.yield_pipeline_status(MOCK_FLOW))
        assert results, f"No results yielded for state '{state}'"
        actual = results[0].right.pipeline_status.executionStatus
        # executionStatus may be the enum instance or its string value depending on
        # the Pydantic model version — normalise both sides to string for comparison.
        actual_val = actual.value if isinstance(actual, StatusType) else actual
        assert actual_val == expected.value, (
            f"State '{state}': expected {expected.value!r}, got {actual_val!r}"
        )

    def test_status_map_success(self):
        self._assert_status("SUCCESS", StatusType.Successful)

    def test_status_map_failed(self):
        self._assert_status("FAILED", StatusType.Failed)

    def test_status_map_killed(self):
        self._assert_status("KILLED", StatusType.Failed)

    def test_status_map_running(self):
        self._assert_status("RUNNING", StatusType.Pending)

    def test_status_map_created(self):
        self._assert_status("CREATED", StatusType.Pending)

    def test_status_map_unknown_defaults_to_pending(self):
        """Any unknown state defaults to Pending."""
        self._assert_status("SOME_FUTURE_STATE", StatusType.Pending)

    def test_status_map_all_defined_states(self):
        """All 10 defined states are present in KESTRA_STATUS_MAP."""
        expected_states = {
            "SUCCESS", "FAILED", "KILLED", "RUNNING", "CREATED",
            "PAUSED", "QUEUED", "RESTARTED", "KILLING", "WARNING",
        }
        assert expected_states == set(KESTRA_STATUS_MAP.keys())

    # -----------------------------------------------------------------------
    # 9.5 — yield_pipeline_lineage_details — valid labels
    # -----------------------------------------------------------------------

    def _make_table_entity(self, fqn_str: str) -> Table:
        t = MagicMock(spec=Table)
        t.id = MagicMock()
        t.id.root = str(uuid.uuid4())
        t.fullyQualifiedName = MagicMock()
        t.fullyQualifiedName.root = fqn_str
        return t

    def test_lineage_input_label(self):
        """Input label produces a table→pipeline lineage edge."""
        flow = KestraFlow(
            id="flow-in",
            namespace="ns",
            labels={"openmetadata.table.input": "svc.db.schema.tbl"},
        )
        mock_table = self._make_table_entity("svc.db.schema.tbl")
        mock_pipeline = MagicMock(spec=Pipeline)
        mock_pipeline.id = MagicMock()
        mock_pipeline.id.root = str(uuid.uuid4())

        self.source.metadata.get_by_name.side_effect = lambda entity, fqn: (
            mock_pipeline if entity == Pipeline else mock_table
        )

        results = [r for r in self.source.yield_pipeline_lineage_details(flow) if r.right]
        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.type == "table"
        assert edge.toEntity.type == "pipeline"

    def test_lineage_output_label(self):
        """Output label produces a pipeline→table lineage edge."""
        flow = KestraFlow(
            id="flow-out",
            namespace="ns",
            labels={"openmetadata.table.output": "svc.db.schema.tbl"},
        )
        mock_table = self._make_table_entity("svc.db.schema.tbl")
        mock_pipeline = MagicMock(spec=Pipeline)
        mock_pipeline.id = MagicMock()
        mock_pipeline.id.root = str(uuid.uuid4())

        self.source.metadata.get_by_name.side_effect = lambda entity, fqn: (
            mock_pipeline if entity == Pipeline else mock_table
        )

        results = [r for r in self.source.yield_pipeline_lineage_details(flow) if r.right]
        assert len(results) == 1
        edge = results[0].right.edge
        assert edge.fromEntity.type == "pipeline"
        assert edge.toEntity.type == "table"

    # -----------------------------------------------------------------------
    # 9.6 — yield_pipeline_lineage_details — unresolvable labels
    # -----------------------------------------------------------------------

    def test_lineage_unresolvable_input(self):
        """Unresolvable input FQN yields no lineage edge."""
        flow = KestraFlow(
            id="flow-bad",
            namespace="ns",
            labels={"openmetadata.table.input": "nonexistent.table"},
        )
        mock_pipeline = MagicMock(spec=Pipeline)
        mock_pipeline.id = MagicMock()
        mock_pipeline.id.root = str(uuid.uuid4())

        # Pipeline resolves, table does not
        self.source.metadata.get_by_name.side_effect = lambda entity, fqn: (
            mock_pipeline if entity == Pipeline else None
        )

        results = [r for r in self.source.yield_pipeline_lineage_details(flow) if r.right]
        assert len(results) == 0

    def test_lineage_no_labels(self):
        """Flow with no labels yields nothing."""
        results = list(self.source.yield_pipeline_lineage_details(MOCK_FLOW_NO_LABELS))
        assert len(results) == 0

    # -----------------------------------------------------------------------
    # 9.7 — round-trip name consistency
    # -----------------------------------------------------------------------

    def test_round_trip_name_consistency(self):
        """get_pipeline_name is always '{namespace}.{id}' for any flow."""
        test_cases = [
            KestraFlow(id="flow-a", namespace="ns1"),
            KestraFlow(id="etl-job", namespace="company.data.team"),
            KestraFlow(id="my_pipeline", namespace="prod"),
            KestraFlow(id="123", namespace="a.b.c.d"),
        ]
        for flow in test_cases:
            expected = f"{flow.namespace}.{flow.id}"
            assert self.source.get_pipeline_name(flow) == expected, (
                f"Mismatch for flow {flow.namespace}/{flow.id}"
            )
