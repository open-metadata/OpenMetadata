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
Pytest-style tests for the Tableau pipeline connector.

Lineage edges are exercised end to end in tests/integration/tableaupipeline.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
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
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.tableaupipeline.metadata import (
    TableaupipelineSource,
)
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauFlowLineage,
    TableauFlowOutputStep,
    TableauLineageDatabase,
    TableauLineageTable,
    TableauPipelineDetails,
    TableauPublishedDatasource,
    TableauRunItem,
    TableauTaskType,
)

MOCK_CONFIG = {
    "source": {
        "type": "tableaupipeline",
        "serviceName": "test_tableau_pipeline",
        "serviceConnection": {
            "config": {
                "type": "TableauPipeline",
                "hostPort": "https://tableau.example.com",
                "authType": {
                    "username": "test_user",
                    "password": "test_pass",
                },
            }
        },
        "sourceConfig": {"config": {"pipelineFilterPattern": {}}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

MOCK_TOKEN_CONFIG = {
    **MOCK_CONFIG,
    "source": {
        **MOCK_CONFIG["source"],
        "serviceName": "test_tableau_pipeline_token",
        "serviceConnection": {
            "config": {
                **MOCK_CONFIG["source"]["serviceConnection"]["config"],
                "authType": {
                    "personalAccessTokenName": "my-token",
                    "personalAccessTokenSecret": "secret-value",
                },
            }
        },
    },
}

MOCK_PIPELINE_SERVICE = PipelineService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="test_tableau_pipeline",
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.TableauPipeline,
)

MOCK_PIPELINE = Pipeline(
    id="d7f1e456-16b2-4a8c-b2f1-1e4c5a6b7c8d",
    name="flow-abc-123",
    fullyQualifiedName="test_tableau_pipeline.flow-abc-123",
    displayName="Sales Data Prep Flow",
    tasks=[
        Task(
            name="flow-abc-123",
            displayName="Sales Data Prep Flow",
        )
    ],
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="pipelineService"),
)

FLOW_RUN_STARTED = datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
FLOW_RUN_COMPLETED = datetime(2025, 1, 15, 10, 5, 30, tzinfo=timezone.utc)
FLOW_RUN_2_STARTED = datetime(2025, 1, 14, 8, 0, 0, tzinfo=timezone.utc)
FLOW_RUN_2_COMPLETED = datetime(2025, 1, 14, 8, 3, 15, tzinfo=timezone.utc)

PIPELINE_DETAILS = TableauPipelineDetails(
    id="flow-abc-123",
    name="flow-abc-123",
    display_name="Sales Data Prep Flow",
    description="Prepares sales data for analysis",
    pipeline_type=TableauTaskType.FLOW_RUN,
    project_name="Sales Project",
    webpage_url="https://tableau.example.com/#/flows/flow-abc-123",
    owner_id="owner-1",
    tags=["sales", "daily"],
)

PIPELINE_DETAILS_MIN = TableauPipelineDetails(
    id="flow-def-456",
    name="flow-def-456",
    display_name="Inventory Flow",
    description=None,
    pipeline_type=TableauTaskType.FLOW_RUN,
    project_name="Inventory Project",
    webpage_url=None,
)

FLOW_RUNS = [
    TableauRunItem(
        id="run-001",
        status="Success",
        started_at=FLOW_RUN_STARTED,
        completed_at=FLOW_RUN_COMPLETED,
    ),
    TableauRunItem(
        id="run-002",
        status="Failed",
        started_at=FLOW_RUN_2_STARTED,
        completed_at=FLOW_RUN_2_COMPLETED,
    ),
]


def _expected_ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def _build_source(config: dict):
    with (
        patch(
            "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection",
            return_value=False,
        ),
        patch("metadata.ingestion.source.pipeline.tableaupipeline.connection.get_connection") as get_conn,
    ):
        mock_conn = MagicMock()
        mock_conn.get_flow_lineage.return_value = None
        get_conn.return_value = mock_conn
        workflow_cfg = OpenMetadataWorkflowConfig.model_validate(config)
        source = TableaupipelineSource.create(
            config["source"],
            workflow_cfg.workflowConfig.openMetadataServerConfig,
        )
        source.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        source.context.get().__dict__["pipeline_service"] = MOCK_PIPELINE_SERVICE.name.root
        return source, mock_conn


@pytest.fixture
def source():
    source, _ = _build_source(MOCK_CONFIG)
    source._current_flow_id = None
    source._current_flow_lineage = None
    source._current_flow_tasks = None
    return source


@pytest.fixture
def mock_conn(source):
    return source.connection


class TestPipelineName:
    def test_display_name_preferred(self, source):
        assert source.get_pipeline_name(PIPELINE_DETAILS) == "Sales Data Prep Flow"

    def test_falls_back_to_id(self, source):
        details = TableauPipelineDetails(
            id="flow-xyz",
            name="flow-xyz",
            display_name=None,
            pipeline_type=TableauTaskType.FLOW_RUN,
        )
        assert source.get_pipeline_name(details) == "flow-xyz"


class TestYieldPipeline:
    def test_yields_single_task_when_no_lineage(self, source):
        results = list(source.yield_pipeline(PIPELINE_DETAILS))
        assert len(results) == 1
        pipeline_request = results[0].right
        assert pipeline_request.name.root == "flow-abc-123"
        assert pipeline_request.displayName == "Sales Data Prep Flow"
        assert pipeline_request.description.root == "Prepares sales data for analysis"
        assert len(pipeline_request.tasks) == 1
        assert pipeline_request.tasks[0].name == "flow-abc-123"

    def test_no_description_yields_none(self, source):
        results = list(source.yield_pipeline(PIPELINE_DETAILS_MIN))
        assert results[0].right.description is None

    def test_error_yields_stacktrace(self, source):
        bad_details = TableauPipelineDetails(
            id="flow-bad",
            name="flow-bad",
            display_name=None,
            pipeline_type=TableauTaskType.FLOW_RUN,
        )
        source.get_source_url = MagicMock(side_effect=RuntimeError("boom"))
        results = list(source.yield_pipeline(bad_details))
        assert len(results) == 1
        assert results[0].left is not None
        assert "boom" in results[0].left.error


class TestNodeLevelTasks:
    def test_fallback_when_no_lineage(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = None
        tasks = source._get_tasks(PIPELINE_DETAILS)
        assert len(tasks) == 1
        assert tasks[0].name == "flow-abc-123"
        assert tasks[0].taskType == "FlowProcessing"

    def test_full_dag(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[
                TableauLineageTable(id="Tabl-1", name="orders"),
                TableauLineageTable(id="Tabl-2", name="customers"),
            ],
            output_steps=[
                TableauFlowOutputStep(id="Out-1", name="Cleaned"),
                TableauFlowOutputStep(id="Out-2", name="Joined"),
            ],
        )
        tasks = source._get_tasks(PIPELINE_DETAILS)
        input_tasks = [t for t in tasks if t.taskType == "FlowInput"]
        output_tasks = [t for t in tasks if t.taskType == "FlowOutputStep"]
        processing = [t for t in tasks if t.taskType == "FlowProcessing"]
        assert len(input_tasks) == 2
        assert len(output_tasks) == 2
        assert len(processing) == 1
        assert processing[0].name == "flow-abc-123"
        assert sorted(processing[0].downstreamTasks) == sorted(t.name for t in output_tasks)
        for t in input_tasks:
            assert t.downstreamTasks == ["flow-abc-123"]

    def test_published_datasource_inputs_become_input_tasks(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_datasources=[TableauPublishedDatasource(id="ds-1", name="Targets", project_name="Sales")],
        )
        tasks = source._get_tasks(PIPELINE_DETAILS)
        inputs = [t for t in tasks if t.taskType == "FlowInput"]
        assert [t.displayName for t in inputs] == ["Targets"]
        assert inputs[0].downstreamTasks == ["flow-abc-123"]
        assert "Sales" in inputs[0].description.root

    def test_sanitizes_opaque_ids(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[
                TableauLineageTable(id="Table:dGFibGUx==/orders", name="orders"),
            ],
            output_steps=[
                TableauFlowOutputStep(id="Output:b3V0/node#1", name="Out1"),
            ],
        )
        names = [t.name for t in source._get_tasks(PIPELINE_DETAILS)]
        assert all(c not in name for name in names for c in (":", "#", "/"))
        assert len(set(names)) == len(names), f"Duplicate task names: {names}"

    def test_tasks_cached_for_status(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[TableauLineageTable(id="Tabl-1", name="orders")],
            output_steps=[TableauFlowOutputStep(id="Out-1", name="Cleaned")],
        )
        source._get_tasks(PIPELINE_DETAILS)
        source._get_tasks(PIPELINE_DETAILS)
        mock_conn.get_flow_lineage.assert_called_once()


class TestYieldPipelineStatus:
    def test_yields_status_per_task(self, source, mock_conn):
        mock_conn.get_flow_runs.return_value = FLOW_RUNS
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[TableauLineageTable(id="Tabl-1", name="orders")],
            output_steps=[TableauFlowOutputStep(id="Out-1", name="Cleaned")],
        )
        source._get_tasks(PIPELINE_DETAILS)

        results = list(source.yield_pipeline_status(PIPELINE_DETAILS))
        assert all(r.left is None for r in results)
        assert len(results) == 2
        status = results[0].right.pipeline_status
        assert len(status.taskStatus) == 3
        assert {ts.executionStatus.value for ts in status.taskStatus} == {"Successful"}
        assert status.timestamp.root == _expected_ms(FLOW_RUN_STARTED)
        assert status.endTime.root == _expected_ms(FLOW_RUN_COMPLETED)
        assert status.executionId == "run-001"

    def test_in_progress_run_is_keyed_on_its_start(self, source, mock_conn):
        mock_conn.get_flow_runs.return_value = [
            TableauRunItem(id="run-live", status="InProgress", started_at=FLOW_RUN_STARTED)
        ]
        status = next(iter(source.yield_pipeline_status(PIPELINE_DETAILS))).right.pipeline_status
        assert status.timestamp.root == _expected_ms(FLOW_RUN_STARTED)
        assert status.endTime is None
        assert status.executionStatus.value == "Pending"

    def test_empty_runs(self, source, mock_conn):
        mock_conn.get_flow_runs.return_value = []
        results = list(source.yield_pipeline_status(PIPELINE_DETAILS_MIN))
        assert results == []

    def test_status_mapping(self):
        assert TableaupipelineSource._get_status(TableauRunItem(id="1", status="Success")).value == "Successful"
        assert TableaupipelineSource._get_status(TableauRunItem(id="2", status="Failed")).value == "Failed"
        assert TableaupipelineSource._get_status(TableauRunItem(id="3", status="Cancelled")).value == "Failed"
        assert TableaupipelineSource._get_status(TableauRunItem(id="4", status="InProgress")).value == "Pending"
        assert TableaupipelineSource._get_status(TableauRunItem(id="5", status=None)).value == "Pending"

    def test_timestamp_none(self):
        assert TableaupipelineSource._to_timestamp(None) is None

    def test_timestamp_valid(self):
        dt = datetime(2025, 1, 15, 10, 0, 0, 500_000, tzinfo=timezone.utc)
        assert TableaupipelineSource._to_timestamp(dt).root == int(dt.timestamp() * 1000)


class TestSourceUrl:
    def test_from_webpage(self, source):
        assert source.get_source_url(PIPELINE_DETAILS).root == "https://tableau.example.com/#/flows/flow-abc-123"

    def test_fallback(self, source):
        assert source.get_source_url(PIPELINE_DETAILS_MIN).root == "https://tableau.example.com/#/flows"


class TestLineage:
    def test_no_metadata(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = None
        assert list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS)) == []

    def test_pipeline_entity_missing(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[TableauLineageTable(id="Tabl-2", name="foo")],
        )
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = None
        assert list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS)) == []

    def test_a_failing_reference_does_not_drop_the_rest(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[TableauLineageTable(id="Tabl-1", name="orders")],
            downstream_datasources=[TableauPublishedDatasource(id="ds-1", name="Sales")],
        )
        pipeline_entity = MagicMock()
        pipeline_entity.id = Uuid(root=uuid4())
        datamodel = MagicMock()
        datamodel.id = Uuid(root=uuid4())
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = pipeline_entity
        source.metadata.search_in_any_service.side_effect = RuntimeError("search down")
        source.metadata.es_search_from_fqn.side_effect = lambda entity_type, **_: (
            [datamodel] if entity_type.__name__ == "DashboardDataModel" else None
        )

        results = list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS))

        assert [r.left.name for r in results if r.left] == ["Lineage"]
        assert [r.right.edge.toEntity.type for r in results if r.right] == ["dashboardDataModel"]


class TestOwners:
    def test_resolves_owner_email_to_reference(self, source, mock_conn):
        mock_conn.get_user_email.return_value = "alice@example.com"
        source.metadata = MagicMock()
        owners_ref = MagicMock()
        source.metadata.get_reference_by_email.return_value = owners_ref
        result = source.get_owners(PIPELINE_DETAILS)
        assert result is owners_ref
        source.metadata.get_reference_by_email.assert_called_once_with(email="alice@example.com", is_owner=True)

    def test_include_owners_off_skips_the_lookup(self, source, mock_conn):
        source.source_config.includeOwners = False
        assert source.get_owners(PIPELINE_DETAILS) is None
        mock_conn.get_user_email.assert_not_called()

    def test_no_owner_id_returns_none(self, source):
        result = source.get_owners(PIPELINE_DETAILS_MIN)
        assert result is None

    def test_email_lookup_failure_returns_none(self, source, mock_conn):
        mock_conn.get_user_email.return_value = None
        assert source.get_owners(PIPELINE_DETAILS) is None
        mock_conn.get_user_email.assert_called_once_with(PIPELINE_DETAILS.owner_id)


class TestTags:
    def test_yields_tag_classification(self, source):
        results = list(source.yield_tag(PIPELINE_DETAILS))
        rights = [r.right for r in results if r.right is not None]
        assert rights, f"No tag results: {results}"

        classification_names = [
            str(r.classification_request.name.root) for r in rights if r.classification_request is not None
        ]
        assert "TableauTags" in classification_names, f"Expected TableauTags classification, got {classification_names}"

        tag_names = [str(r.tag_request.name.root) for r in rights if r.tag_request is not None]
        assert "sales" in tag_names, f"Expected 'sales' in {tag_names}"
        assert "daily" in tag_names, f"Expected 'daily' in {tag_names}"

    def test_no_tags_yields_nothing(self, source):
        assert list(source.yield_tag(PIPELINE_DETAILS_MIN)) == []


class TestPipelineList:
    def test_get_pipelines_list(self, source, mock_conn):
        mock_conn.get_pipelines.return_value = iter(
            [
                TableauPipelineDetails(
                    id="flow-mock",
                    name="flow-mock",
                    display_name="Mock Flow",
                    pipeline_type=TableauTaskType.FLOW_RUN,
                )
            ]
        )
        pipelines = list(source.get_pipelines_list())
        assert [p.id for p in pipelines] == ["flow-mock"]


def test_source_accepts_access_token_auth():
    source, _ = _build_source(MOCK_TOKEN_CONFIG)
    assert source is not None
    results = list(source.yield_pipeline(PIPELINE_DETAILS))
    assert results[0].right is not None


class TestFlowEviction:
    def test_cache_evicts_when_flow_advances(self, source, mock_conn):
        lineage_a = TableauFlowLineage(id="flow-a", upstream_tables=[])
        lineage_b = TableauFlowLineage(id="flow-b", upstream_tables=[])
        mock_conn.get_flow_lineage.side_effect = [lineage_a, lineage_b]

        flow_a = TableauPipelineDetails(id="flow-a", name="flow-a", pipeline_type=TableauTaskType.FLOW_RUN)
        flow_b = TableauPipelineDetails(id="flow-b", name="flow-b", pipeline_type=TableauTaskType.FLOW_RUN)

        first = source._get_flow_lineage(flow_a.id)
        second = source._get_flow_lineage(flow_b.id)
        assert first is lineage_a
        assert second is lineage_b
        assert mock_conn.get_flow_lineage.call_count == 2

    def test_lineage_cache_hit_on_same_flow(self, source, mock_conn):
        lineage = TableauFlowLineage(id="flow-a", upstream_tables=[])
        mock_conn.get_flow_lineage.return_value = lineage

        first = source._get_flow_lineage("flow-a")
        second = source._get_flow_lineage("flow-a")
        assert first is lineage
        assert second is lineage
        mock_conn.get_flow_lineage.assert_called_once_with("flow-a")

    def test_lineage_fetch_exception_returns_none(self, source, mock_conn):
        mock_conn.get_flow_lineage.side_effect = RuntimeError("API down")
        assert source._get_flow_lineage("flow-x") is None


class TestTaskHelpers:
    def test_unique_name_appends_suffix_on_collision(self):
        used = {"input_foo", "input_foo_2"}
        assert TableaupipelineSource._unique_name("input_foo", used) == "input_foo_3"
        assert TableaupipelineSource._unique_name("input_bar", set()) == "input_bar"

    def test_input_task_description_includes_source_and_connection(self):

        upstream = TableauLineageTable(
            id="Tabl-1",
            name="orders",
            full_name="warehouse.public.orders",
            database=TableauLineageDatabase(name="warehouse", connection_type="postgres"),
        )
        desc = TableaupipelineSource._input_task_description(upstream).root
        assert "warehouse.public.orders" in desc
        assert "postgres" in desc

    def test_input_task_description_empty_upstream_returns_none(self):
        upstream = TableauLineageTable()
        assert TableaupipelineSource._input_task_description(upstream) is None

    def test_timestamp_rejects_invalid_datetime(self, caplog):
        class Exploding:
            def timestamp(self):
                raise OverflowError("out of range")

        result = TableaupipelineSource._to_timestamp(Exploding())
        assert result is None

    def test_get_status_with_missing_status(self):
        from metadata.generated.schema.entity.data.pipeline import StatusType

        run = TableauRunItem(id="r", status=None)
        assert TableaupipelineSource._get_status(run) == StatusType.Pending

    def test_get_status_with_unknown_status(self):
        from metadata.generated.schema.entity.data.pipeline import StatusType

        run = TableauRunItem(id="r", status="NeverSeenBefore")
        assert TableaupipelineSource._get_status(run) == StatusType.Pending


class TestLineageEdgeCases:
    def test_lookup_datamodel_no_matches(self, source):
        source.metadata = MagicMock()
        source.metadata.es_search_from_fqn.return_value = []
        assert source._lookup_datamodel("missing", None) is None

    def test_lookup_datamodel_on_exception(self, source):
        source.metadata = MagicMock()
        source.metadata.es_search_from_fqn.side_effect = RuntimeError("ES down")
        assert source._lookup_datamodel("anything", "Sales") is None

    def test_lookup_datamodel_without_id(self, source):
        source.metadata = MagicMock()
        assert source._lookup_datamodel(None, "Sales") is None
        source.metadata.es_search_from_fqn.assert_not_called()

    def test_resolve_upstream_with_db_service_names(self, source, mock_conn):
        """Exercises the db_service_names loop in _resolve_table_entity."""

        source.source_config = MagicMock()
        source.source_config.lineageInformation = MagicMock()
        source.source_config.lineageInformation.dbServiceNames = ["warehouse"]
        source.metadata = MagicMock()
        source.metadata.es_search_from_fqn.return_value = []
        table = MagicMock()
        table.id = Uuid(root=uuid4())
        source.metadata.get_by_name.return_value = table

        resolved = source._resolve_table_entity(
            TableauLineageTable(
                id="Tabl-1",
                name="orders",
                schema_="public",
                database=TableauLineageDatabase(name="warehouse"),
            )
        )
        assert resolved is table

    def test_resolve_tables_from_sql_unparseable(self, source):
        # Return value from the parser — unparseable should yield empty list
        result = source._resolve_tables_from_sql("not valid sql at all ;")
        assert isinstance(result, list)

    def test_resolve_tables_from_sql_preserves_database_in_candidate(self, source):
        """When the parser returns a three-part name like `db.schema.table`,
        the candidate passed to _resolve_table_entity must carry the database
        name — otherwise downstream FQN lookup falls back to a broad
        `*.schema.table` search that can resolve the wrong table."""
        captured: list[TableauLineageTable] = []

        def fake_resolve(candidate):
            captured.append(candidate)
            return

        source._resolve_table_entity = fake_resolve
        source._resolve_tables_from_sql("SELECT * FROM sales_db.public.orders")

        assert captured, "Parser yielded no candidates"
        candidate = captured[0]
        assert candidate.full_name == "sales_db.public.orders"
        assert candidate.schema_ == "public"
        assert candidate.database is not None
        assert candidate.database.name == "sales_db"

    def test_get_source_url_exception_returns_none(self, source):
        # Force service_connection.hostPort to raise via str()
        bad = MagicMock()
        bad.hostPort = MagicMock()

        class Bad:
            def __str__(self):
                raise RuntimeError("nope")

        pd = TableauPipelineDetails(
            id="x",
            name="x",
            pipeline_type=TableauTaskType.FLOW_RUN,
        )
        source.service_connection = MagicMock()
        source.service_connection.hostPort = Bad()
        assert source.get_source_url(pd) is None


class TestInvalidSourceException:
    def test_create_rejects_non_tableau_pipeline_config(self):
        from metadata.ingestion.api.steps import InvalidSourceException

        bad_config = dict(MOCK_CONFIG["source"])
        bad_config["serviceConnection"] = {
            "config": {
                "type": "Airflow",
                "hostPort": "http://airflow/",
                "connection": {
                    "type": "Backend",
                },
            }
        }
        with pytest.raises(InvalidSourceException):
            TableaupipelineSource.create(bad_config, MagicMock())


class TestExceptionPaths:
    def test_yield_tag_respects_include_tags_off(self, source):
        source.source_config = MagicMock()
        source.source_config.includeTags = False
        results = list(source.yield_tag(PIPELINE_DETAILS))
        assert results == []

    def test_tag_labels_respects_include_tags_off(self, source):
        source.source_config = MagicMock()
        source.source_config.includeTags = False
        assert source._tag_labels_for_pipeline(PIPELINE_DETAILS) == []

    def test_get_owners_user_email_lookup_exception(self, source, mock_conn):
        mock_conn.get_user_email.side_effect = RuntimeError("boom")
        assert source.get_owners(PIPELINE_DETAILS) is None

    def test_get_owners_reference_lookup_exception(self, source, mock_conn):
        mock_conn.get_user_email.return_value = "alice@example.com"
        source.metadata = MagicMock()
        source.metadata.get_reference_by_email.side_effect = RuntimeError("ES down")
        assert source.get_owners(PIPELINE_DETAILS) is None

    def test_yield_pipeline_status_handles_runs_exception(self, source, mock_conn):
        mock_conn.get_flow_runs.side_effect = RuntimeError("network flap")
        results = list(source.yield_pipeline_status(PIPELINE_DETAILS))
        assert len(results) == 1
        assert results[0].left is not None
        assert "network flap" in results[0].left.error

    def test_yield_pipeline_status_skips_run_without_timestamps(self, source, mock_conn):
        mock_conn.get_flow_runs.return_value = [
            TableauRunItem(id="r", status="Success", started_at=None, completed_at=None)
        ]
        results = list(source.yield_pipeline_status(PIPELINE_DETAILS))
        # All runs skipped — no statuses, but no errors either
        assert results == []

    def test_input_task_name_no_id(self):
        task_name = TableaupipelineSource._input_task_name(None, set())
        assert task_name is None

    def test_output_task_name_no_id(self):
        from metadata.ingestion.source.pipeline.tableaupipeline.models import (
            TableauFlowOutputStep,
        )

        task_name = TableaupipelineSource._output_task_name(
            TableauFlowOutputStep(),  # empty
            set(),
        )
        assert task_name is None


class TestCloseLifecycle:
    def test_close_clears_caches_and_signs_out(self, source, mock_conn):
        source.metadata = MagicMock()
        source._current_flow_id = "flow-a"
        source._current_flow_lineage = MagicMock()
        source._current_flow_tasks = [MagicMock()]

        source.close()

        assert source._current_flow_id is None
        assert source._current_flow_lineage is None
        assert source._current_flow_tasks is None
        mock_conn.sign_out.assert_called_once()

    def test_close_swallows_signout_errors(self, source, mock_conn):
        source.metadata = MagicMock()
        mock_conn.sign_out.side_effect = RuntimeError("offline")

        source.close()
