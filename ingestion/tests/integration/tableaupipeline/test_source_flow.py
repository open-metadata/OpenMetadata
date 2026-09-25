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
End-to-end integration tests for the Tableau Pipeline connector.

These exercise the full source surface the topology runner invokes:
- get_pipelines_list → yield_pipeline → yield_tag → yield_pipeline_status
  → yield_pipeline_lineage_details
Using a fake TSC-backed client with realistic data shapes.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList

from ._fixtures import (  # noqa: TID252
    EXTRACT_EXEC_WORKBOOK,
    EXTRACT_SALES,
    FLOW_MARKETING,
    FLOW_SALES,
)

SERVICE = "tableau_prep_integration"


def _mock_entity(uuid=None):
    entity = MagicMock()
    entity.id = Uuid(root=uuid or uuid4())
    return entity


class Catalog:
    """What OpenMetadata already holds, served through the OMeta calls the source makes."""

    def __init__(self):
        self.entities: dict[tuple[type, str], MagicMock] = {}
        self.datamodels: dict[str, MagicMock] = {}

    def add(self, entity_type: type, fqn: str) -> MagicMock:
        entity = _mock_entity()
        self.entities[(entity_type, fqn)] = entity
        return entity

    def add_datamodel(self, name: str) -> MagicMock:
        entity = _mock_entity()
        self.datamodels[name] = entity
        return entity

    def get_by_name(self, entity, fqn, **_kwargs):
        return self.entities.get((entity, fqn))

    def es_search_from_fqn(self, entity_type, fqn_search_string, **_kwargs):
        if entity_type is not DashboardDataModel:
            return None
        return [dm for name, dm in self.datamodels.items() if fqn_search_string == f"*.{name}"] or None

    def wire(self, source):
        source.metadata.get_by_name.side_effect = self.get_by_name
        source.metadata.es_search_from_fqn.side_effect = self.es_search_from_fqn
        source.metadata.search_in_any_service.return_value = None


def _lineage(source, flow, catalog):
    catalog.wire(source)
    source.context.get().__dict__["pipeline"] = flow.name
    return [r.right for r in source.yield_pipeline_lineage_details(flow) if r.right is not None]


def _edge(request):
    return (str(request.edge.fromEntity.id.root), str(request.edge.toEntity.id.root))


class TestIngestionFlow:
    def test_pipeline_list_includes_sales_and_marketing(self, tableau_source):
        source, _ = tableau_source
        names = [p.name for p in source.get_pipelines_list()]
        assert names == ["flow-sales", "flow-marketing", "ds-sales-published", "wb-exec"]

    def test_yield_pipeline_sales_has_full_node_dag(self, tableau_source):
        source, _ = tableau_source
        source.metadata.get_reference_by_email.return_value = EntityReferenceList(
            root=[EntityReference(id=uuid4(), type="user")]
        )
        results = list(source.yield_pipeline(FLOW_SALES))
        assert len(results) == 1, f"Expected 1 request, got {results}"
        request = results[0].right
        assert request is not None, f"Expected right, got left: {results[0].left}"
        assert request.name.root == "flow-sales"
        assert request.displayName == "Sales Prep Flow"

        task_types = [t.taskType for t in request.tasks]
        # Two upstream tables and one upstream published data source.
        assert task_types.count("FlowInput") == 3
        assert task_types.count("FlowOutputStep") == 1
        assert task_types.count("FlowProcessing") == 1

        assert request.owners is not None
        source.metadata.get_reference_by_email.assert_called_once_with(email="alice@example.com", is_owner=True)

    def test_owners_are_skipped_when_include_owners_is_off(self, tableau_source):
        source, _ = tableau_source
        source.source_config.includeOwners = False

        request = next(iter(source.yield_pipeline(FLOW_SALES))).right

        assert request.owners is None
        source.metadata.get_reference_by_email.assert_not_called()

    def test_yield_pipeline_marketing_without_owner_or_tags(self, tableau_source):
        source, _ = tableau_source
        results = list(source.yield_pipeline(FLOW_MARKETING))
        request = results[0].right
        assert request.owners is None
        assert request.tags is None

    def test_yield_tag_emits_classification_only_when_tags_exist(self, tableau_source):
        source, _ = tableau_source
        sales_tags = list(source.yield_tag(FLOW_SALES))
        marketing_tags = list(source.yield_tag(FLOW_MARKETING))
        assert len(sales_tags) > 0
        assert marketing_tags == []


class TestPipelineStatus:
    def test_status_per_task_for_multi_node_flow(self, tableau_source):
        source, _ = tableau_source
        source.context.get().__dict__["pipeline"] = FLOW_SALES.name

        results = list(source.yield_pipeline_status(FLOW_SALES))
        assert all(r.left is None for r in results)
        assert len(results) == 2

        first = results[0].right
        assert first.pipeline_fqn == f"{SERVICE}.flow-sales"
        task_names = [ts.name for ts in first.pipeline_status.taskStatus]
        assert any(n.startswith("input_") for n in task_names)
        assert "flow-sales" in task_names
        assert any(n.startswith("output_") for n in task_names)
        assert first.pipeline_status.executionStatus.value == "Successful"

    def test_a_run_is_keyed_on_its_start_so_it_is_stored_once(self, tableau_source):
        """An in-progress run and the same run once finished must land on the
        same status row, so the key cannot be completedAt."""
        source, _ = tableau_source
        source.context.get().__dict__["pipeline"] = FLOW_SALES.name

        status = next(iter(source.yield_pipeline_status(FLOW_SALES))).right.pipeline_status

        started = int(datetime(2025, 4, 22, 6, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
        completed = int(datetime(2025, 4, 22, 6, 3, 15, tzinfo=timezone.utc).timestamp() * 1000)
        assert status.timestamp.root == started
        assert status.endTime.root == completed
        assert status.executionId == "run-s1"

    def test_empty_runs_yields_nothing(self, tableau_source):
        source, _ = tableau_source
        source.context.get().__dict__["pipeline"] = FLOW_MARKETING.name
        results = list(source.yield_pipeline_status(FLOW_MARKETING))
        assert results == []


class TestLineage:
    def test_flow_sits_between_its_inputs_and_outputs(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        flow = catalog.add(Pipeline, f"{SERVICE}.flow-sales")
        downstream_flow = catalog.add(Pipeline, f"{SERVICE}.flow-marketing")
        orders = catalog.add(Table, "warehouse.warehouse.public.orders")
        customers = catalog.add(Table, "warehouse.warehouse.public.customers")
        sales_clean = catalog.add(Table, "warehouse.warehouse.mart.sales_clean")
        targets = catalog.add_datamodel("gql-ds-targets")
        published = catalog.add_datamodel("gql-ds-sales-published")

        edges = {_edge(r) for r in _lineage(source, FLOW_SALES, catalog)}

        flow_id = str(flow.id.root)
        assert edges == {
            (str(orders.id.root), flow_id),
            (str(customers.id.root), flow_id),
            (str(targets.id.root), flow_id),
            (flow_id, str(sales_clean.id.root)),
            (flow_id, str(published.id.root)),
            (flow_id, str(downstream_flow.id.root)),
        }

    def test_data_sources_resolve_by_metadata_api_id_not_luid(self, tableau_source):
        """The dashboard connector names data models after the Metadata API id;
        a lookup by the REST luid never finds them."""
        source, _ = tableau_source
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.flow-sales")
        catalog.add_datamodel("ds-sales-published")

        requests = _lineage(source, FLOW_SALES, catalog)

        assert [r for r in requests if r.edge.toEntity.type == "dashboardDataModel"] == []

    def test_edges_through_the_flow_carry_it_as_the_pipeline(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        flow = catalog.add(Pipeline, f"{SERVICE}.flow-sales")
        catalog.add(Pipeline, f"{SERVICE}.flow-marketing")
        catalog.add(Table, "warehouse.warehouse.public.orders")

        requests = _lineage(source, FLOW_SALES, catalog)

        table_edge = next(r for r in requests if r.edge.fromEntity.type == "table")
        assert table_edge.edge.lineageDetails.pipeline.id == flow.id
        assert table_edge.edge.lineageDetails.columnsLineage is None
        flow_edge = next(
            r for r in requests if r.edge.toEntity.type == "pipeline" and r.edge.fromEntity.type == "pipeline"
        )
        assert flow_edge.edge.lineageDetails.pipeline is None

    def test_named_upstream_table_is_not_expanded_through_other_queries(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.flow-sales")
        payroll = catalog.add(Table, "warehouse.warehouse.public.payroll")

        requests = _lineage(source, FLOW_SALES, catalog)

        assert str(payroll.id.root) not in {_edge(r)[0] for r in requests}

    def test_unnamed_upstream_table_resolves_through_its_custom_sql(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        flow = catalog.add(Pipeline, f"{SERVICE}.flow-marketing")
        orders = catalog.add(Table, "warehouse.warehouse.public.orders")

        requests = _lineage(source, FLOW_MARKETING, catalog)

        assert {_edge(r) for r in requests} == {(str(orders.id.root), str(flow.id.root))}

    def test_unresolved_references_emit_no_edges(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.flow-sales")

        assert _lineage(source, FLOW_SALES, catalog) == []


class TestExtractRefresh:
    def test_is_a_single_task_pipeline_without_flow_lineage(self, tableau_source):
        source, client = tableau_source

        request = next(iter(source.yield_pipeline(EXTRACT_SALES))).right

        assert request.displayName == "Published Sales Datasource extract refresh"
        assert [(t.name, t.taskType) for t in request.tasks] == [("ds-sales-published", "ExtractRefresh")]
        assert str(request.sourceUrl.root) == "https://tableau.example.com/#/datasources/ds-sales-published"
        assert client.lineage_requests == []

    def test_refresh_jobs_become_status_with_the_failure_reason(self, tableau_source):
        source, _ = tableau_source
        source.context.get().__dict__["pipeline"] = EXTRACT_SALES.name

        statuses = [r.right.pipeline_status for r in source.yield_pipeline_status(EXTRACT_SALES)]

        assert [(s.executionId, s.executionStatus.value) for s in statuses] == [
            ("job-2", "Failed"),
            ("job-1", "Successful"),
        ]
        failed = statuses[0]
        assert failed.error.errorMessage == "Unable to connect to the server warehouse.example.com"
        assert failed.timestamp.root == int(datetime(2025, 4, 22, 7, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
        assert [t.name for t in failed.taskStatus] == ["ds-sales-published"]
        assert statuses[1].error is None

    def test_points_at_the_data_models_it_refreshes(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        refresh = catalog.add(Pipeline, f"{SERVICE}.wb-exec")
        orders = catalog.add_datamodel("gql-exec-orders")
        targets = catalog.add_datamodel("gql-exec-targets")

        requests = _lineage(source, EXTRACT_EXEC_WORKBOOK, catalog)

        refresh_id = str(refresh.id.root)
        assert {_edge(r) for r in requests} == {(refresh_id, str(orders.id.root)), (refresh_id, str(targets.id.root))}
        assert all(r.edge.lineageDetails.pipeline.id == refresh.id for r in requests)

    def test_no_edge_until_the_dashboard_connector_has_the_data_model(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.ds-sales-published")

        assert _lineage(source, EXTRACT_SALES, catalog) == []
