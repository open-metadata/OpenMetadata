"""
Pytest-style tests for the Tableau pipeline connector.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
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
    TableauDownstreamDatasource,
    TableauDownstreamFlow,
    TableauFlowLineage,
    TableauFlowOutputField,
    TableauFlowOutputStep,
    TableauFlowRunItem,
    TableauFlowUpstreamColumn,
    TableauLineageDatabase,
    TableauLineageTable,
    TableauPipelineDetails,
    TableauReferencedQuery,
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
    service=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="pipelineService"
    ),
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
    TableauFlowRunItem(
        id="run-001",
        flow_id="flow-abc-123",
        status="Success",
        started_at=FLOW_RUN_STARTED,
        completed_at=FLOW_RUN_COMPLETED,
    ),
    TableauFlowRunItem(
        id="run-002",
        flow_id="flow-abc-123",
        status="Failed",
        started_at=FLOW_RUN_2_STARTED,
        completed_at=FLOW_RUN_2_COMPLETED,
    ),
]


def _expected_ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def _build_source(config: dict):
    with patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection",
        return_value=False,
    ), patch(
        "metadata.ingestion.source.pipeline.tableaupipeline.connection.get_connection"
    ) as get_conn:
        mock_conn = MagicMock()
        mock_conn.get_flow_lineage.return_value = None
        get_conn.return_value = mock_conn
        workflow_cfg = OpenMetadataWorkflowConfig.model_validate(config)
        source = TableaupipelineSource.create(
            config["source"],
            workflow_cfg.workflowConfig.openMetadataServerConfig,
        )
        source.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        source.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root
        return source, mock_conn


@pytest.fixture
def source():
    source, mock_conn = _build_source(MOCK_CONFIG)
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
        pipeline_request: CreatePipelineRequest = results[0].right
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
        assert sorted(processing[0].downstreamTasks) == sorted(
            t.name for t in output_tasks
        )
        for t in input_tasks:
            assert t.downstreamTasks == ["flow-abc-123"]

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
        status: PipelineStatus = results[0].right.pipeline_status
        assert len(status.taskStatus) == 3
        assert {ts.executionStatus.value for ts in status.taskStatus} == {"Successful"}

    def test_empty_runs(self, source, mock_conn):
        mock_conn.get_flow_runs.return_value = []
        results = list(source.yield_pipeline_status(PIPELINE_DETAILS_MIN))
        assert results == []

    def test_status_mapping(self):
        assert (
            TableaupipelineSource._get_status(
                TableauFlowRunItem(id="1", status="Success")
            ).value
            == "Successful"
        )
        assert (
            TableaupipelineSource._get_status(
                TableauFlowRunItem(id="2", status="Failed")
            ).value
            == "Failed"
        )
        assert (
            TableaupipelineSource._get_status(
                TableauFlowRunItem(id="3", status="Cancelled")
            ).value
            == "Failed"
        )
        assert (
            TableaupipelineSource._get_status(
                TableauFlowRunItem(id="4", status="InProgress")
            ).value
            == "Pending"
        )
        assert (
            TableaupipelineSource._get_status(
                TableauFlowRunItem(id="5", status=None)
            ).value
            == "Pending"
        )

    def test_timestamp_none(self):
        assert TableaupipelineSource._to_timestamp(None) is None

    def test_timestamp_valid(self):
        dt = datetime(2025, 1, 15, 10, 0, 0, 500_000, tzinfo=timezone.utc)
        assert TableaupipelineSource._to_timestamp(dt).root == int(
            dt.timestamp() * 1000
        )


class TestSourceUrl:
    def test_from_webpage(self, source):
        assert (
            source.get_source_url(PIPELINE_DETAILS).root
            == "https://tableau.example.com/#/flows/flow-abc-123"
        )

    def test_fallback(self, source):
        assert (
            source.get_source_url(PIPELINE_DETAILS_MIN).root
            == "https://tableau.example.com/#/flows"
        )


class TestLineage:
    def test_no_metadata(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = None
        assert list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS)) == []

    def test_upstream_resolved_with_column_lineage(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[
                TableauLineageTable(
                    id="Tabl-1",
                    name="orders",
                    full_name="sales.public.orders",
                    schema_="public",
                    database=TableauLineageDatabase(name="sales"),
                )
            ],
            output_fields=[
                TableauFlowOutputField(
                    id="o1",
                    name="order_id_clean",
                    upstream_columns=[
                        TableauFlowUpstreamColumn(
                            id="c1",
                            name="order_id",
                            table=TableauLineageTable(id="Tabl-1", name="orders"),
                        )
                    ],
                )
            ],
        )
        table_uuid, pipeline_uuid = uuid4(), uuid4()
        table_entity = MagicMock()
        table_entity.id = Uuid(root=table_uuid)
        pipeline_entity = MagicMock()
        pipeline_entity.id = Uuid(root=pipeline_uuid)
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = pipeline_entity
        source.metadata.search_in_any_service.return_value = table_entity

        results = list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS))
        rights = [r for r in results if r.right is not None]
        assert len(rights) >= 1
        edge = rights[0].right.edge
        assert str(edge.fromEntity.id.root) == str(table_uuid)
        assert str(edge.toEntity.id.root) == str(pipeline_uuid)
        assert edge.lineageDetails.columnsLineage is not None

    def test_pipeline_entity_missing(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[TableauLineageTable(id="Tabl-2", name="foo")],
        )
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = None
        assert list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS)) == []

    def test_upstream_unresolved(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[TableauLineageTable(id="Tabl-3", name="missing")],
        )
        pipeline_entity = MagicMock()
        pipeline_entity.id = Uuid(root=uuid4())
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = pipeline_entity
        source.metadata.search_in_any_service.return_value = None
        assert list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS)) == []

    def test_downstream_flow_edge(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[],
            downstream_flows=[TableauDownstreamFlow(luid="flow-xyz", name="Next Flow")],
        )
        pipeline_uuid, downstream_uuid = uuid4(), uuid4()
        this_pipeline = MagicMock()
        this_pipeline.id = Uuid(root=pipeline_uuid)
        downstream = MagicMock()
        downstream.id = Uuid(root=downstream_uuid)
        source.metadata = MagicMock()
        source.metadata.get_by_name.side_effect = [this_pipeline, downstream]
        results = list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS))
        rights = [r for r in results if r.right is not None]
        assert len(rights) == 1
        edge = rights[0].right.edge
        assert edge.fromEntity.type == "pipeline"
        assert edge.toEntity.type == "pipeline"
        assert str(edge.toEntity.id.root) == str(downstream_uuid)

    def test_downstream_datasource_edge(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[],
            downstream_datasources=[
                TableauDownstreamDatasource(
                    luid="datasource-xyz", name="Sales Datasource"
                )
            ],
        )
        pipeline_uuid, dm_uuid = uuid4(), uuid4()
        this_pipeline = MagicMock()
        this_pipeline.id = Uuid(root=pipeline_uuid)
        datamodel = MagicMock()
        datamodel.id = Uuid(root=dm_uuid)
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = this_pipeline
        source.metadata.es_search_from_fqn.return_value = [datamodel]
        results = list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS))
        rights = [r for r in results if r.right is not None]
        assert len(rights) == 1
        assert rights[0].right.edge.toEntity.type == "dashboardDataModel"

    def test_custom_sql_parsing(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[
                TableauLineageTable(
                    id="Tabl-1",
                    name="",
                    referenced_by_queries=[
                        TableauReferencedQuery(
                            id="q1",
                            query="SELECT a, b FROM sales.public.orders JOIN sales.public.customers ON a = b",
                        )
                    ],
                )
            ],
        )
        table_uuid, pipeline_uuid = uuid4(), uuid4()
        table_entity = MagicMock()
        table_entity.id = Uuid(root=table_uuid)
        pipeline_entity = MagicMock()
        pipeline_entity.id = Uuid(root=pipeline_uuid)
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = pipeline_entity
        source.metadata.search_in_any_service.return_value = table_entity
        results = list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS))
        rights = [r for r in results if r.right is not None]
        assert len(rights) >= 1


class TestOwners:
    def test_resolves_owner_email_to_reference(self, source, mock_conn):
        mock_conn.get_user_email.return_value = "alice@example.com"
        source.metadata = MagicMock()
        owners_ref = MagicMock()
        source.metadata.get_reference_by_email.return_value = owners_ref
        result = source.get_owners(PIPELINE_DETAILS)
        assert result is owners_ref
        source.metadata.get_reference_by_email.assert_called_once_with(
            email="alice@example.com", is_owner=True
        )

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
            str(r.classification_request.name.root)
            for r in rights
            if r.classification_request is not None
        ]
        assert (
            "TableauTags" in classification_names
        ), f"Expected TableauTags classification, got {classification_names}"

        tag_names = [
            str(r.tag_request.name.root) for r in rights if r.tag_request is not None
        ]
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

        flow_a = TableauPipelineDetails(
            id="flow-a", name="flow-a", pipeline_type=TableauTaskType.FLOW_RUN
        )
        flow_b = TableauPipelineDetails(
            id="flow-b", name="flow-b", pipeline_type=TableauTaskType.FLOW_RUN
        )

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
        from metadata.ingestion.source.pipeline.tableaupipeline.models import (
            TableauLineageDatabase,
        )

        upstream = TableauLineageTable(
            id="Tabl-1",
            name="orders",
            full_name="warehouse.public.orders",
            database=TableauLineageDatabase(
                name="warehouse", connection_type="postgres"
            ),
        )
        desc = TableaupipelineSource._input_task_description(upstream)
        assert desc is not None
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

        run = TableauFlowRunItem(id="r", status=None)
        assert TableaupipelineSource._get_status(run) == StatusType.Pending

    def test_get_status_with_unknown_status(self):
        from metadata.generated.schema.entity.data.pipeline import StatusType

        run = TableauFlowRunItem(id="r", status="NeverSeenBefore")
        assert TableaupipelineSource._get_status(run) == StatusType.Pending


class TestLineageEdgeCases:
    def test_downstream_flow_edge_skips_when_not_found(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[],
            downstream_flows=[
                TableauDownstreamFlow(luid="flow-missing", name="Next"),
            ],
        )
        this_pipeline = MagicMock()
        this_pipeline.id = Uuid(root=uuid4())
        source.metadata = MagicMock()
        # first get_by_name returns this pipeline, second returns None (downstream missing)
        source.metadata.get_by_name.side_effect = [this_pipeline, None]

        results = list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS))
        rights = [r for r in results if r.right is not None]
        assert rights == []

    def test_downstream_flow_edge_skips_when_id_blank(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[],
            downstream_flows=[TableauDownstreamFlow()],  # no luid / id
        )
        this_pipeline = MagicMock()
        this_pipeline.id = Uuid(root=uuid4())
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = this_pipeline

        results = list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS))
        assert [r for r in results if r.right is not None] == []

    def test_downstream_datasource_skips_when_id_blank(self, source, mock_conn):
        mock_conn.get_flow_lineage.return_value = TableauFlowLineage(
            id="flow-abc-123",
            upstream_tables=[],
            downstream_datasources=[TableauDownstreamDatasource()],
        )
        this_pipeline = MagicMock()
        this_pipeline.id = Uuid(root=uuid4())
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = this_pipeline

        results = list(source.yield_pipeline_lineage_details(PIPELINE_DETAILS))
        assert [r for r in results if r.right is not None] == []

    def test_lookup_datamodel_by_id_no_matches(self, source):
        source.metadata = MagicMock()
        source.metadata.es_search_from_fqn.return_value = []
        assert source._lookup_datamodel_by_id("missing") is None

    def test_lookup_datamodel_by_id_on_exception(self, source):
        source.metadata = MagicMock()
        source.metadata.es_search_from_fqn.side_effect = RuntimeError("ES down")
        assert source._lookup_datamodel_by_id("anything") is None

    def test_resolve_upstream_with_db_service_names(self, source, mock_conn):
        """Exercises the db_service_names loop in _resolve_table_entity."""
        from metadata.ingestion.source.pipeline.tableaupipeline.models import (
            TableauLineageDatabase,
        )

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
        captured: List[TableauLineageTable] = []

        def fake_resolve(candidate):
            captured.append(candidate)
            return None

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

    def test_yield_pipeline_status_skips_run_without_timestamps(
        self, source, mock_conn
    ):
        mock_conn.get_flow_runs.return_value = [
            TableauFlowRunItem(
                id="r", status="Success", started_at=None, completed_at=None
            )
        ]
        results = list(source.yield_pipeline_status(PIPELINE_DETAILS))
        # All runs skipped — no statuses, but no errors either
        assert results == []

    def test_build_column_lineage_skips_malformed_output_fields(self, source):
        """Covers the continue branches in _build_column_lineage_index."""
        from metadata.ingestion.source.pipeline.tableaupipeline.models import (
            TableauFlowOutputField,
            TableauFlowUpstreamColumn,
        )

        lineage = TableauFlowLineage(
            id="flow",
            output_fields=[
                TableauFlowOutputField(id="f1", name=None),  # no name → skip
                TableauFlowOutputField(
                    id="f2",
                    name="out",
                    upstream_columns=[
                        TableauFlowUpstreamColumn(name=None),  # no col name
                        TableauFlowUpstreamColumn(name="col", table=None),  # no table
                    ],
                ),
                TableauFlowOutputField(
                    id="f3",
                    name="out2",
                    upstream_columns=[
                        TableauFlowUpstreamColumn(
                            name="a",
                            table=TableauLineageTable(id="t1", name="x"),
                        ),
                        TableauFlowUpstreamColumn(
                            name="a",  # duplicate (a, out2) → dedup continue
                            table=TableauLineageTable(id="t1", name="x"),
                        ),
                    ],
                ),
            ],
        )
        idx = source._build_column_lineage_index(lineage)
        assert "t1" in idx
        assert len(idx["t1"]) == 1  # deduplicated

    def test_input_task_name_no_id(self):
        task_name = TableaupipelineSource._input_task_name(
            TableauLineageTable(),  # no id, luid, or name
            set(),
        )
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
        # Should not raise
        source.close()

    def test_close_without_connection_attribute(self, source):
        source.metadata = MagicMock()
        # Simulate partial init where connection was never set
        if hasattr(source, "connection"):
            del source.connection
        # Should not raise
        source.close()
