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
Source-level tests for the Tableau Pipeline connector: the stages the topology
runner invokes (get_pipelines_list → yield_pipeline → yield_tag →
yield_pipeline_status → yield_pipeline_lineage_details → post-process), run
against a fake client and an in-memory OpenMetadata catalog.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.source.pipeline.tableaupipeline.client import (
    TableauMetadataApiError,
)

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
        self.datamodels: list[tuple[str, MagicMock]] = []

    def add(self, entity_type: type, fqn: str) -> MagicMock:
        entity = _mock_entity()
        self.entities[(entity_type, fqn)] = entity
        return entity

    def add_datamodel(self, name: str) -> MagicMock:
        entity = _mock_entity()
        self.datamodels.append((name, entity))
        return entity

    def get_by_name(self, entity, fqn, **_kwargs):
        return self.entities.get((entity, fqn))

    def es_search_from_fqn(self, entity_type, fqn_search_string, **_kwargs):
        if entity_type is not DashboardDataModel:
            return None
        return [dm for name, dm in self.datamodels if fqn_search_string == f"*.{name}"] or None

    def wire(self, source):
        source.metadata.get_by_name.side_effect = self.get_by_name
        source.metadata.es_search_from_fqn.side_effect = self.es_search_from_fqn
        source.metadata.search_in_any_service.return_value = None


def _lineage(source, pipeline, catalog):
    catalog.wire(source)
    return [r.right for r in source.yield_pipeline_lineage_details(pipeline) if r.right is not None]


def _edge(request):
    return (str(request.edge.fromEntity.id.root), str(request.edge.toEntity.id.root))


class TestIngestionFlow:
    def test_pipeline_list_holds_flows_then_extract_refreshes(self, tableau_source):
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
        source.metadata.get_reference_by_email.assert_called_once_with(email="alice@example.com")

    def test_owners_are_skipped_when_include_owners_is_off(self, tableau_source):
        source, _ = tableau_source
        source.source_config.includeOwners = False

        request = next(iter(source.yield_pipeline(FLOW_SALES))).right

        assert request.owners is None
        source.metadata.get_reference_by_email.assert_not_called()

    def test_yield_pipeline_marketing_without_owner_or_tags(self, tableau_source):
        source, _ = tableau_source
        request = next(iter(source.yield_pipeline(FLOW_MARKETING))).right
        assert request.owners is None
        assert request.tags is None

    def test_yield_tag_emits_classification_only_when_tags_exist(self, tableau_source):
        source, _ = tableau_source
        assert list(source.yield_tag(FLOW_SALES))
        assert list(source.yield_tag(FLOW_MARKETING)) == []

    def test_lineage_is_queried_once_per_flow_even_without_records(self, tableau_source):
        source, client = tableau_source
        catalog = Catalog()
        catalog.wire(source)

        list(source.yield_pipeline(FLOW_MARKETING))
        list(source.yield_pipeline_lineage_details(FLOW_MARKETING))
        list(source.yield_pipeline(EXTRACT_SALES))

        assert client.lineage_requests == ["flow-marketing"]

    def test_an_unreachable_metadata_api_keeps_the_existing_tasks(self, tableau_source, monkeypatch):
        """A transient Metadata API failure must not collapse the flow's DAG to a
        single task until the next run."""
        source, client = tableau_source
        catalog = Catalog()
        existing = catalog.add(Pipeline, f"{SERVICE}.flow-sales")
        existing.tasks = [Task(name="input_orders"), Task(name="flow-sales"), Task(name="output_clean")]
        catalog.wire(source)

        def unreachable(flow_id):
            raise TableauMetadataApiError(f"Tableau Metadata API query failed for flow {flow_id}: 503")

        monkeypatch.setattr(client, "get_flow_lineage", unreachable)

        request = next(iter(source.yield_pipeline(FLOW_SALES))).right

        assert [t.name for t in request.tasks] == ["input_orders", "flow-sales", "output_clean"]


class TestDeletion:
    def test_a_partial_extract_listing_deletes_nothing(self, tableau_source):
        source, client = tableau_source
        client.extract_refresh_listing_complete = False

        assert list(source.mark_pipelines_as_deleted()) == []
        source.metadata.delete_stale_entities.assert_not_called()

    def test_a_complete_listing_marks_missing_pipelines_deleted(self, tableau_source):
        source, _ = tableau_source

        assert list(source.mark_pipelines_as_deleted())
        source.metadata.delete_stale_entities.assert_called_once()


class TestPipelineStatus:
    def test_status_per_task_for_multi_node_flow(self, tableau_source):
        source, _ = tableau_source

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

    def test_status_goes_to_this_pipeline_even_with_a_stale_context(self, tableau_source):
        """When yield_pipeline fails for a flow, the topology context still names
        the previous pipeline; the status must not be attached to it."""
        source, _ = tableau_source
        source.context.get().__dict__["pipeline"] = "flow-marketing"

        statuses = [r.right for r in source.yield_pipeline_status(FLOW_SALES)]

        assert {s.pipeline_fqn for s in statuses} == {f"{SERVICE}.flow-sales"}

    def test_a_run_is_keyed_on_its_start_so_it_is_stored_once(self, tableau_source):
        """An in-progress run and the same run once finished must land on the
        same status row, so the key cannot be completedAt."""
        source, _ = tableau_source

        status = next(iter(source.yield_pipeline_status(FLOW_SALES))).right.pipeline_status

        started = int(datetime(2025, 4, 22, 6, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
        completed = int(datetime(2025, 4, 22, 6, 3, 15, tzinfo=timezone.utc).timestamp() * 1000)
        assert status.timestamp.root == started
        assert status.endTime.root == completed
        assert status.executionId == "run-s1"

    def test_empty_runs_yields_nothing(self, tableau_source):
        source, _ = tableau_source
        assert list(source.yield_pipeline_status(FLOW_MARKETING)) == []


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

    def test_edges_do_not_name_the_pipeline_they_end_at(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.flow-sales")
        catalog.add(Pipeline, f"{SERVICE}.flow-marketing")
        catalog.add(Table, "warehouse.warehouse.public.orders")

        requests = _lineage(source, FLOW_SALES, catalog)

        assert requests
        assert all(r.edge.lineageDetails.pipeline is None for r in requests)
        assert {r.edge.lineageDetails.source for r in requests} == {LineageSource.PipelineLineage}

    def test_data_sources_resolve_by_metadata_api_id_not_luid(self, tableau_source):
        """The dashboard connector names data models after the Metadata API id;
        a lookup by the REST luid never finds them."""
        source, _ = tableau_source
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.flow-sales")
        catalog.add_datamodel("ds-sales-published")

        requests = _lineage(source, FLOW_SALES, catalog)

        assert [r for r in requests if r.edge.toEntity.type == "dashboardDataModel"] == []

    def test_every_dashboard_service_ingesting_the_site_gets_the_edge(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        flow = catalog.add(Pipeline, f"{SERVICE}.flow-sales")
        prod = catalog.add_datamodel("gql-ds-sales-published")
        staging = catalog.add_datamodel("gql-ds-sales-published")

        requests = _lineage(source, FLOW_SALES, catalog)

        to_models = {_edge(r) for r in requests if r.edge.toEntity.type == "dashboardDataModel"}
        assert to_models == {(str(flow.id.root), str(prod.id.root)), (str(flow.id.root), str(staging.id.root))}

    def test_a_downstream_flow_ingested_later_is_linked_in_the_post_process(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        flow = catalog.add(Pipeline, f"{SERVICE}.flow-sales")

        flow_edges = [r for r in _lineage(source, FLOW_SALES, catalog) if r.edge.toEntity.type == "pipeline"]
        assert flow_edges == []

        downstream = catalog.add(Pipeline, f"{SERVICE}.flow-marketing")
        deferred = [r.right for r in source.yield_pipeline_bulk_lineage_details()]

        assert [_edge(r) for r in deferred] == [(str(flow.id.root), str(downstream.id.root))]
        assert list(source.yield_pipeline_bulk_lineage_details()) == []

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

    def test_no_edge_until_the_dashboard_connector_has_the_data_model(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.ds-sales-published")

        assert _lineage(source, EXTRACT_SALES, catalog) == []

    def test_an_unreachable_metadata_api_skips_only_the_lineage(self, tableau_source, monkeypatch):
        source, client = tableau_source

        def unreachable(target_type, luid):
            raise TableauMetadataApiError(f"Tableau Metadata API query failed for {target_type} {luid}: 503")

        monkeypatch.setattr(client, "get_extract_datasource_ids", unreachable)

        assert list(source.yield_pipeline_lineage_details(EXTRACT_SALES)) == []
