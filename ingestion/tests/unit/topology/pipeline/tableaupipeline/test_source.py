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

import logging
from datetime import datetime, timezone
from fnmatch import fnmatchcase
from unittest.mock import MagicMock
from uuid import uuid4

from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import BasicAuth
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import MysqlConnection
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Uuid
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.source.pipeline.tableaupipeline.client import (
    TableauMetadataApiError,
)
from metadata.ingestion.source.pipeline.tableaupipeline.models import (
    TableauFlowLineage,
    TableauLineageDatabase,
    TableauLineageTable,
    TableauPublishedDatasource,
)
from metadata.utils.fqn import prefix_entity_for_wildcard_search

from ._fixtures import (  # noqa: TID252
    EXTRACT_EXEC_WORKBOOK,
    EXTRACT_SALES,
    FLOW_MARKETING,
    FLOW_SALES,
)

SERVICE = "tableau_prep_integration"
MYSQL_SERVICE = "shop_mysql"


def _mock_entity(uuid=None):
    entity = MagicMock()
    entity.id = Uuid(root=uuid or uuid4())
    return entity


class Catalog:
    """What OpenMetadata already holds, served through the OMeta calls the source
    makes. As on the server, lookups by name ignore case and table searches match
    FQN wildcards."""

    def __init__(self):
        self.entities: dict[tuple[type, str], MagicMock] = {}
        self.unindexed: set[str] = set()
        self.datamodels: list[tuple[str, MagicMock]] = []
        # The dbServiceNames of WORKFLOW_CONFIG: a service with databases of its own.
        self.add_service("warehouse", PostgresConnection(username="u", hostPort="localhost:5432", database="warehouse"))

    def add(self, entity_type: type, entity_fqn: str, indexed: bool = True) -> MagicMock:
        entity = _mock_entity()
        entity.fullyQualifiedName = FullyQualifiedEntityName(entity_fqn)
        self.entities[(entity_type, entity_fqn.lower())] = entity
        if not indexed:
            self.unindexed.add(entity_fqn.lower())
        return entity

    def add_service(self, name: str, config) -> MagicMock:
        service = MagicMock()
        service.connection.config = config
        self.entities[(DatabaseService, name.lower())] = service
        return service

    def add_datamodel(self, name: str) -> MagicMock:
        entity = _mock_entity()
        self.datamodels.append((name, entity))
        return entity

    def get_by_name(self, entity, fqn, **_kwargs):
        return self.entities.get((entity, fqn.lower()))

    def es_search_from_fqn(self, entity_type, fqn_search_string, **_kwargs):
        if entity_type is DashboardDataModel:
            return [dm for name, dm in self.datamodels if fqn_search_string == f"*.{name}"] or None
        pattern = fqn_search_string.lower()
        return [
            entity
            for (kind, key), entity in self.entities.items()
            if kind is entity_type and key not in self.unindexed and fnmatchcase(key, pattern)
        ] or None

    def search_in_any_service(self, entity_type, fqn_search_string, fetch_multiple_entities=False):
        matches = self.es_search_from_fqn(
            entity_type, prefix_entity_for_wildcard_search(entity_type, fqn_search_string)
        )
        return matches if fetch_multiple_entities or not matches else matches[0]

    def wire(self, source):
        source.metadata.get_by_name.side_effect = self.get_by_name
        source.metadata.es_search_from_fqn.side_effect = self.es_search_from_fqn
        source.metadata.search_in_any_service.side_effect = self.search_in_any_service


def _lineage(source, pipeline, catalog):
    catalog.wire(source)
    return [r.right for r in source.yield_pipeline_lineage_details(pipeline) if r.right is not None]


def _edge(request):
    return (str(request.edge.fromEntity.id.root), str(request.edge.toEntity.id.root))


def _id(entity) -> str:
    return str(entity.id.root)


def _asset_edges(requests):
    return {_edge(r) for r in requests if "pipeline" not in (r.edge.fromEntity.type, r.edge.toEntity.type)}


def _table(table_id: str, name: str, schema: str = "public") -> TableauLineageTable:
    return TableauLineageTable(
        id=table_id,
        name=name,
        full_name=f"[{schema}].[{name}]",
        schema_=schema,
        database=TableauLineageDatabase(name="warehouse", connection_type="postgres"),
    )


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
    def _sales_catalog(self):
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.flow-sales")
        catalog.add(Pipeline, f"{SERVICE}.flow-marketing")
        return catalog

    def test_each_input_is_linked_to_the_outputs_its_fields_are_written_to(self, tableau_source):
        """The Sales flow runs two branches; the tables must not be tied to the
        republished data source, nor the targets to sales_clean."""
        source, _ = tableau_source
        catalog = self._sales_catalog()
        orders = catalog.add(Table, "warehouse.warehouse.public.orders")
        customers = catalog.add(Table, "warehouse.warehouse.public.customers")
        sales_clean = catalog.add(Table, "warehouse.warehouse.mart.sales_clean")
        targets = catalog.add_datamodel("gql-ds-targets")
        published = catalog.add_datamodel("gql-ds-sales-published")

        edges = _asset_edges(_lineage(source, FLOW_SALES, catalog))

        assert edges == {
            (_id(orders), _id(sales_clean)),
            (_id(customers), _id(sales_clean)),
            (_id(targets), _id(published)),
        }

    def test_asset_edges_name_the_flow_as_their_pipeline(self, tableau_source):
        source, _ = tableau_source
        catalog = self._sales_catalog()
        flow = catalog.entities[(Pipeline, f"{SERVICE}.flow-sales")]
        catalog.add(Table, "warehouse.warehouse.public.orders")
        catalog.add(Table, "warehouse.warehouse.mart.sales_clean")

        requests = _lineage(source, FLOW_SALES, catalog)

        asset_requests = [r for r in requests if r.edge.toEntity.type == "table"]
        assert asset_requests
        assert {str(r.edge.lineageDetails.pipeline.id.root) for r in asset_requests} == {_id(flow)}
        assert {r.edge.lineageDetails.pipeline.type for r in asset_requests} == {"pipeline"}
        assert {r.edge.lineageDetails.source for r in requests} == {LineageSource.PipelineLineage}

    def test_the_flow_is_linked_to_the_flows_that_consume_it(self, tableau_source):
        source, _ = tableau_source
        catalog = self._sales_catalog()
        flow = catalog.entities[(Pipeline, f"{SERVICE}.flow-sales")]
        marketing = catalog.entities[(Pipeline, f"{SERVICE}.flow-marketing")]

        requests = _lineage(source, FLOW_SALES, catalog)

        flow_requests = [r for r in requests if r.edge.toEntity.type == "pipeline"]
        assert [_edge(r) for r in flow_requests] == [(_id(flow), _id(marketing))]
        assert flow_requests[0].edge.lineageDetails.pipeline is None

    def test_a_single_input_feeds_every_output_without_asking_for_field_lineage(self, tableau_source, monkeypatch):
        source, client = tableau_source
        lineage = TableauFlowLineage(
            upstream_tables=[_table("t-orders", "orders")],
            downstream_tables=[_table("t-sales-clean", "sales_clean", schema="mart")],
            downstream_datasources=[TableauPublishedDatasource(id="gql-ds-sales-published", name="Sales")],
        )
        monkeypatch.setattr(client, "get_flow_lineage", lambda _flow_id: lineage)
        catalog = self._sales_catalog()
        orders = catalog.add(Table, "warehouse.warehouse.public.orders")
        sales_clean = catalog.add(Table, "warehouse.warehouse.mart.sales_clean")
        published = catalog.add_datamodel("gql-ds-sales-published")

        edges = _asset_edges(_lineage(source, FLOW_SALES, catalog))

        assert edges == {(_id(orders), _id(sales_clean)), (_id(orders), _id(published))}
        assert client.field_lineage_requests == []

    def test_without_field_lineage_several_inputs_and_outputs_draw_no_asset_edges(
        self, tableau_source, monkeypatch, caplog
    ):
        source, client = tableau_source
        monkeypatch.setattr(client, "get_flow_output_fields", lambda _flow_id: [])
        catalog = self._sales_catalog()
        catalog.add(Table, "warehouse.warehouse.public.orders")
        catalog.add(Table, "warehouse.warehouse.mart.sales_clean")

        with caplog.at_level(logging.WARNING):
            requests = _lineage(source, FLOW_SALES, catalog)

        assert _asset_edges(requests) == set()
        assert [r.edge.toEntity.type for r in requests] == ["pipeline"]
        assert "did not say which inputs of flow Sales Prep Flow feed which of its outputs" in caplog.text

    def test_an_unreachable_field_lineage_query_keeps_the_flow_edges(self, tableau_source, monkeypatch):
        source, client = tableau_source

        def unreachable(flow_id):
            raise TableauMetadataApiError(f"Tableau Metadata API query failed for field lineage of flow {flow_id}")

        monkeypatch.setattr(client, "get_flow_output_fields", unreachable)
        catalog = self._sales_catalog()
        catalog.add(Table, "warehouse.warehouse.public.orders")
        catalog.add(Table, "warehouse.warehouse.mart.sales_clean")

        requests = _lineage(source, FLOW_SALES, catalog)

        assert [r.edge.toEntity.type for r in requests] == ["pipeline"]

    def test_a_flow_that_updates_a_table_it_reads_draws_no_edge_onto_itself(self, tableau_source, monkeypatch):
        source, client = tableau_source
        lineage = TableauFlowLineage(
            upstream_tables=[_table("t-orders-in", "orders")],
            downstream_tables=[_table("t-orders-out", "orders")],
        )
        monkeypatch.setattr(client, "get_flow_lineage", lambda _flow_id: lineage)
        catalog = self._sales_catalog()
        catalog.add(Table, "warehouse.warehouse.public.orders")

        assert _asset_edges(_lineage(source, FLOW_SALES, catalog)) == set()

    def test_data_sources_resolve_by_metadata_api_id_not_luid(self, tableau_source):
        """The dashboard connector names data models after the Metadata API id;
        a lookup by the REST luid never finds them."""
        source, _ = tableau_source
        catalog = self._sales_catalog()
        catalog.add_datamodel("ds-targets")
        catalog.add_datamodel("ds-sales-published")

        requests = _lineage(source, FLOW_SALES, catalog)

        assert _asset_edges(requests) == set()

    def test_every_dashboard_service_ingesting_the_site_gets_the_edge(self, tableau_source):
        source, _ = tableau_source
        catalog = self._sales_catalog()
        targets = catalog.add_datamodel("gql-ds-targets")
        prod = catalog.add_datamodel("gql-ds-sales-published")
        staging = catalog.add_datamodel("gql-ds-sales-published")

        edges = _asset_edges(_lineage(source, FLOW_SALES, catalog))

        assert edges == {(_id(targets), _id(prod)), (_id(targets), _id(staging))}

    def test_a_downstream_flow_ingested_later_is_linked_in_the_post_process(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        flow = catalog.add(Pipeline, f"{SERVICE}.flow-sales")

        flow_edges = [r for r in _lineage(source, FLOW_SALES, catalog) if r.edge.toEntity.type == "pipeline"]
        assert flow_edges == []

        downstream = catalog.add(Pipeline, f"{SERVICE}.flow-marketing")
        deferred = [r.right for r in source.yield_pipeline_bulk_lineage_details()]

        assert [_edge(r) for r in deferred] == [(_id(flow), _id(downstream))]
        assert list(source.yield_pipeline_bulk_lineage_details()) == []

    def test_named_upstream_table_is_not_expanded_through_other_queries(self, tableau_source):
        source, _ = tableau_source
        catalog = self._sales_catalog()
        payroll = catalog.add(Table, "warehouse.warehouse.public.payroll")
        catalog.add(Table, "warehouse.warehouse.mart.sales_clean")

        requests = _lineage(source, FLOW_SALES, catalog)

        assert _id(payroll) not in {_edge(r)[0] for r in requests}

    def test_unnamed_upstream_table_resolves_through_its_custom_sql(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.flow-marketing")
        orders = catalog.add(Table, "warehouse.warehouse.public.orders")
        mart = catalog.add(Table, "warehouse.warehouse.mart.marketing_mart")

        requests = _lineage(source, FLOW_MARKETING, catalog)

        assert _asset_edges(requests) == {(_id(orders), _id(mart))}

    def test_unresolved_references_emit_no_edges(self, tableau_source):
        source, _ = tableau_source
        catalog = Catalog()
        catalog.add(Pipeline, f"{SERVICE}.flow-sales")

        assert _lineage(source, FLOW_SALES, catalog) == []


class TestTableResolution:
    """Tableau reports a table as its source does; OpenMetadata files it by
    service type. These are the shapes the dashboard Tableau connector resolves."""

    MYSQL_CUSTOMERS = TableauLineageTable(
        id="t-customers",
        name="customers",
        full_name="[shop].[customers]",
        schema_="",
        database=TableauLineageDatabase(name="shop", connection_type="mysql"),
    )

    @staticmethod
    def _mysql_catalog(source) -> Catalog:
        """A MySQL service as OpenMetadata files it: one `default` database, with
        each MySQL database as a schema. Tables added first are found first."""
        catalog = Catalog()
        catalog.add_service(
            MYSQL_SERVICE, MysqlConnection(username="u", authType=BasicAuth(password="p"), hostPort="localhost:3306")
        )
        catalog.wire(source)
        return catalog

    def test_a_single_database_service_is_searched_under_its_default_database(self, tableau_source):
        """OpenMetadata files a MySQL service under one `default` database, and
        Tableau's database is the MySQL schema."""
        source, _ = tableau_source
        source.source_config.lineageInformation.dbServiceNames = [MYSQL_SERVICE]
        customers = self._mysql_catalog(source).add(Table, f"{MYSQL_SERVICE}.default.shop.customers")

        assert source._resolve_table_entity(self.MYSQL_CUSTOMERS) is customers

    def test_a_same_named_table_in_another_mysql_database_does_not_get_the_edge(self, tableau_source):
        source, _ = tableau_source
        source.source_config.lineageInformation.dbServiceNames = [MYSQL_SERVICE]
        catalog = self._mysql_catalog(source)
        catalog.add(Table, f"{MYSQL_SERVICE}.default.staging.customers")
        customers = catalog.add(Table, f"{MYSQL_SERVICE}.default.shop.customers")

        assert source._resolve_table_entity(self.MYSQL_CUSTOMERS) is customers

    def test_a_file_the_flow_reads_is_not_taken_for_a_table_of_the_same_name(self, tableau_source):
        """Tableau reports an Excel sheet with its workbook as the database and
        no schema, and OpenMetadata names ignore case."""
        source, _ = tableau_source
        source.source_config.lineageInformation.dbServiceNames = [MYSQL_SERVICE]
        self._mysql_catalog(source).add(Table, f"{MYSQL_SERVICE}.default.sales.orders")
        excel_orders = TableauLineageTable(
            id="t-sheet-orders",
            name="Orders",
            full_name="[Orders$]",
            schema_="",
            database=TableauLineageDatabase(name="Sample - Superstore.xls", connection_type="excel-direct"),
        )

        assert source._resolve_table_entity(excel_orders) is None

    def test_custom_sql_naming_only_the_table_finds_the_one_table_of_that_name(self, tableau_source):
        source, _ = tableau_source
        source.source_config.lineageInformation.dbServiceNames = [MYSQL_SERVICE]
        orders = self._mysql_catalog(source).add(Table, f"{MYSQL_SERVICE}.default.sales.orders")

        assert source._resolve_tables_from_sql("SELECT id FROM orders") == [orders]

    def test_custom_sql_naming_only_the_table_finds_nothing_when_several_tables_match(self, tableau_source):
        source, _ = tableau_source
        source.source_config.lineageInformation.dbServiceNames = [MYSQL_SERVICE]
        catalog = self._mysql_catalog(source)
        catalog.add(Table, f"{MYSQL_SERVICE}.default.staging.customers")
        catalog.add(Table, f"{MYSQL_SERVICE}.default.shop.customers")

        assert source._resolve_tables_from_sql("SELECT id FROM customers") == []

    def test_a_full_name_resolves_before_search_has_indexed_the_table(self, tableau_source):
        source, _ = tableau_source
        source.source_config.lineageInformation.dbServiceNames = [MYSQL_SERVICE]
        catalog = self._mysql_catalog(source)
        customers = catalog.add(Table, f"{MYSQL_SERVICE}.default.shop.customers", indexed=False)

        assert source._resolve_table_entity(self.MYSQL_CUSTOMERS) is customers

    def test_without_configured_services_the_full_name_finds_the_table(self, tableau_source):
        source, _ = tableau_source
        source.source_config.lineageInformation.dbServiceNames = []
        customers = self._mysql_catalog(source).add(Table, f"{MYSQL_SERVICE}.default.shop.customers")

        assert source._resolve_table_entity(self.MYSQL_CUSTOMERS) is customers

    def test_names_that_match_several_tables_do_not_fall_back_to_looser_ones(self, tableau_source):
        source, _ = tableau_source
        source.source_config.lineageInformation.dbServiceNames = []
        catalog = Catalog()
        catalog.add(Table, "prod.warehouse.public.orders")
        catalog.add(Table, "staging.warehouse.public.orders")
        catalog.wire(source)

        assert source._resolve_table_entity(_table("t-orders", "orders")) is None

    def test_upper_case_names_resolve_as_the_server_ignores_case(self, tableau_source):
        """Tableau reports Snowflake identifiers upper case; OpenMetadata stores them lower case."""
        source, _ = tableau_source
        catalog = Catalog()
        orders = catalog.add(Table, "warehouse.sales_db.public.orders")
        catalog.wire(source)
        snowflake_orders = TableauLineageTable(
            id="t-orders",
            name="ORDERS",
            full_name="[SALES_DB].[PUBLIC].[ORDERS]",
            schema_="PUBLIC",
            database=TableauLineageDatabase(name="SALES_DB", connection_type="snowflake"),
        )

        assert source._resolve_table_entity(snowflake_orders) is orders


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
