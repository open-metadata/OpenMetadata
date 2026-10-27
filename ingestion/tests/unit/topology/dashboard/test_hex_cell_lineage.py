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
Hex data models and column lineage built from the SQL cells of a project
"""

import fnmatch
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from requests import HTTPError

from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.hexConnection import HexConnection
from metadata.generated.schema.entity.services.dashboardService import DashboardServiceType
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.dashboard.hex.cell_lineage import (
    get_output_columns,
    get_table_references,
    inline_upstream_cells,
    parse_cell_sql,
)
from metadata.ingestion.source.dashboard.hex.client import HexApiClient
from metadata.ingestion.source.dashboard.hex.metadata import HexSource
from metadata.ingestion.source.dashboard.hex.models import Cell, CellContents, DataConnection, Project, SqlCellContents
from metadata.ingestion.source.dashboard.hex.query_fetcher import HexProjectLineage

SERVICE = "hex_service"
PROJECT = Project(id="proj_1", title="Sales Overview")
SALES_SCHEMA = {
    "prod": {
        "sales": {
            "orders": {"id": "unknown", "cust_id": "unknown", "amount": "unknown", "region": "unknown"},
            "customers": {"id": "unknown", "segment": "unknown", "name": "unknown"},
        }
    }
}


def outputs(sql: str, schema=None, connection_type="snowflake") -> dict[str, set]:
    expression = parse_cell_sql(sql, connection_type)
    return {column.name: column.sources for column in get_output_columns(expression, schema or SALES_SCHEMA)}


ORDERS = ("prod", "sales", "orders")
CUSTOMERS = ("prod", "sales", "customers")


class TestCellSqlParsing:
    def test_join_with_aliases_and_aggregate(self):
        assert outputs(
            "select o.region, sum(o.amount) as revenue, c.segment from prod.sales.orders o "
            "join prod.sales.customers c on o.cust_id = c.id group by 1, 3"
        ) == {
            "region": {(ORDERS, "region")},
            "revenue": {(ORDERS, "amount")},
            "segment": {(CUSTOMERS, "segment")},
        }

    def test_unqualified_columns_resolve_through_the_schema(self):
        assert outputs(
            "select region, segment from prod.sales.orders join prod.sales.customers on cust_id = customers.id"
        ) == {"region": {(ORDERS, "region")}, "segment": {(CUSTOMERS, "segment")}}

    def test_select_star_expands_from_the_schema(self):
        assert outputs("select * from prod.sales.customers") == {
            "id": {(CUSTOMERS, "id")},
            "segment": {(CUSTOMERS, "segment")},
            "name": {(CUSTOMERS, "name")},
        }

    def test_cte_and_unaliased_expression(self):
        assert outputs(
            "with paid as (select * from prod.sales.orders) select region, count(*) as n, amount * 2 from paid"
        ) == {"region": {(ORDERS, "region")}, "n": set(), "_col_2": {(ORDERS, "amount")}}

    def test_star_over_an_unknown_table_yields_no_column(self):
        assert outputs("select * from other.misc.unknown_table", schema={}) == {}

    def test_cte_is_not_a_table_reference(self):
        expression = parse_cell_sql("with paid as (select * from sales.orders) select * from paid", "snowflake")
        assert [table.sql() for table in get_table_references(expression)] == ["sales.orders"]

    def test_bigquery_backticks_parse_with_the_connection_dialect(self):
        expression = parse_cell_sql("select region from `prod.sales.orders`", "bigquery")
        assert [(t.catalog, t.db, t.name) for t in get_table_references(expression)] == [("prod", "sales", "orders")]

    def test_unknown_connection_type_falls_back_to_the_default_dialect(self):
        assert parse_cell_sql("select 1", "not_a_dialect") is not None

    def test_input_parameters_parse_as_values(self):
        assert outputs(
            "select region, {{ target }} as target from prod.sales.orders "
            "{% if region %}where region = {{ region }}{% endif %}"
        ) == {"region": {(ORDERS, "region")}, "target": set()}

    def test_unparseable_sql_is_skipped(self):
        assert parse_cell_sql("select * from where", "snowflake") is None

    def test_quoted_identifiers_resolve_whatever_their_case(self):
        users = ("prod", "public", "users")
        schema = {"prod": {"public": {"users": {"createdAt": "unknown", "id": "unknown"}}}}

        assert outputs(
            'select u."createdAt", id as "Sales Id" from prod.public.users u', schema, connection_type="postgres"
        ) == {"createdat": {(users, "createdat")}, "sales id": {(users, "id")}}
        assert outputs('select o."REGION" from prod.sales.orders o') == {"region": {(ORDERS, "region")}}

    def test_star_over_a_dataframe_keeps_the_known_tables_columns(self):
        assert outputs("select c.*, t.* from prod.sales.customers c join df_targets t on c.id = t.id") == {
            "id": {(CUSTOMERS, "id")},
            "segment": {(CUSTOMERS, "segment")},
            "name": {(CUSTOMERS, "name")},
        }

    def test_chained_cells_resolve_through_the_cells_they_read(self):
        base = parse_cell_sql("with paid as (select * from prod.sales.orders) select * from paid", "snowflake")
        won = parse_cell_sql("select region, amount from base_orders where amount > 0", "snowflake")
        assert inline_upstream_cells(won, {"base_orders": base})
        pacing = parse_cell_sql("select region, sum(amount) as total from won_orders group by 1", "duckdb")
        assert inline_upstream_cells(pacing, {"won_orders": won})

        assert {column.name: column.sources for column in get_output_columns(pacing, SALES_SCHEMA)} == {
            "region": {(ORDERS, "region")},
            "total": {(ORDERS, "amount")},
        }

    def test_query_reading_no_other_cell_is_left_alone(self):
        expression = parse_cell_sql("select * from prod.sales.orders", "snowflake")
        assert not inline_upstream_cells(expression, {"base_orders": parse_cell_sql("select 1", None)})

    def test_non_query_statement_is_skipped(self):
        assert parse_cell_sql("create table t as select 1", "snowflake") is None


def make_table(name: str, columns: dict[str, DataType]) -> Table:
    table_fqn = f"snowflake_prod.prod.sales.{name}"
    return Table(
        id=uuid.uuid4(),
        name=name,
        fullyQualifiedName=table_fqn,
        columns=[
            Column(name=column, dataType=data_type, fullyQualifiedName=f"{table_fqn}.{column}")
            for column, data_type in columns.items()
        ],
    )


ORDERS_TABLE = make_table(
    "orders",
    {"id": DataType.INT, "cust_id": DataType.INT, "amount": DataType.DOUBLE, "region": DataType.VARCHAR},
)
CUSTOMERS_TABLE = make_table("customers", {"id": DataType.INT, "segment": DataType.VARCHAR})

REVENUE_CELL = Cell(
    id="c1",
    label="Revenue by region",
    cellType="SQL",
    dataConnectionId="conn_snowflake",
    contents={
        "sqlCell": {
            "source": "select o.region, sum(o.amount) as revenue, c.segment from sales.orders o "
            "join sales.customers c on o.cust_id = c.id group by 1, 3"
        }
    },
)
CUSTOMERS_CELL = Cell(
    id="c2",
    label="Revenue by region",
    cellType="SQL",
    dataConnectionId="conn_snowflake",
    contents={"sqlCell": {"source": "select * from sales.customers"}},
)
DATAFRAME_CELL = Cell(
    id="c3",
    label="Dataframe SQL",
    cellType="SQL",
    contents={"sqlCell": {"source": "select * from dataframe_1"}},
)
MARKDOWN_CELL = Cell(id="c4", cellType="MARKDOWN")


class FakeOpenMetadata:
    """The server side: table search and the entities this run has written"""

    def __init__(self, tables: list[Table]):
        self.tables = tables
        self.entities: dict[str, object] = {}
        self.searches: list[str] = []
        self.search_error: Exception | None = None

    def es_search_from_fqn(self, entity_type, fqn_search_string, raise_on_error=False):
        """The server's FQN wildcard search is case-insensitive"""
        self.searches.append(fqn_search_string)
        if self.search_error:
            raise self.search_error
        hits = [
            table
            for table in self.tables
            if fnmatch.fnmatch(table.fullyQualifiedName.root.lower(), fqn_search_string.lower())
        ]
        return hits or None

    def get_by_name(self, entity, fqn, **_):
        found = self.entities.get(fqn)
        return found if isinstance(found, entity) else None

    def store_data_model(self, request) -> DashboardDataModel:
        """What the server makes of a data model request: every column gets its FQN"""
        model_fqn = f"{SERVICE}.model.{request.name.root}"
        columns = [
            Column.model_validate(
                {
                    **column.model_dump(exclude_none=True),
                    "fullyQualifiedName": f"{model_fqn}.{column.name.root}",
                    "children": [
                        {
                            **child.model_dump(exclude_none=True),
                            "fullyQualifiedName": f"{model_fqn}.{column.name.root}.{child.name.root}",
                        }
                        for child in column.children
                    ],
                }
            )
            for column in request.columns
        ]
        data_model = DashboardDataModel(
            id=uuid.uuid4(),
            name=request.name,
            fullyQualifiedName=model_fqn,
            dataModelType=request.dataModelType,
            columns=columns,
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        )
        self.entities[model_fqn] = data_model
        return data_model


@pytest.fixture
def make_source():
    def _make(cells, include_data_models=True, prefixes=None, tables=(ORDERS_TABLE, CUSTOMERS_TABLE)):
        source = HexSource.__new__(HexSource)
        source.metadata = FakeOpenMetadata(list(tables))
        source.metadata.entities[f"{SERVICE}.{PROJECT.id}"] = Dashboard(
            id=uuid.uuid4(),
            name=PROJECT.id,
            fullyQualifiedName=f"{SERVICE}.{PROJECT.id}",
            service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        )
        source.config = SimpleNamespace(serviceName=SERVICE)
        source.source_config = DashboardServiceMetadataPipeline(
            includeDataModels=include_data_models,
            lineageInformation={"dbServicePrefixes": prefixes} if prefixes else None,
        )
        source.service_connection = SimpleNamespace(type=DashboardServiceType.Hex)
        source.context = MagicMock()
        source.context.get.return_value = SimpleNamespace(dashboard_service=SERVICE)
        source.client = MagicMock()
        source.client.get_project_cells.return_value = cells
        source.client.get_data_connections.return_value = {
            "conn_snowflake": DataConnection(id="conn_snowflake", name="Snowflake", type="snowflake")
        }
        source.client.get_project_url.return_value = "https://app.hex.tech/app/projects/proj_1"
        source.datamodel_source_state = set()
        source.dashboard_source_state = set()
        source.hex_project_lineage = {}
        source._cell_lineage = None
        source._data_connections = None
        return source

    return _make


def run(source, prefixes=(None,)):
    """Data model stage, then the lineage stage once per db service prefix, as the topology runs them"""
    data_model_requests = [either.right for either in source.yield_datamodel(PROJECT)]
    for request in data_model_requests:
        source.metadata.store_data_model(request)
    edges = [
        either.right.edge
        for prefix in prefixes
        for either in source.yield_dashboard_lineage_details(PROJECT, prefix)
        if either and either.right
    ]
    return data_model_requests, edges


def column_lineage(edge) -> dict[str, list[str]]:
    return {
        lineage.toColumn.root: [column.root for column in lineage.fromColumns]
        for lineage in edge.lineageDetails.columnsLineage or []
    }


class TestHexCellLineage:
    def test_one_data_model_per_project_with_a_struct_per_sql_cell(self, make_source):
        source = make_source([REVENUE_CELL, CUSTOMERS_CELL, DATAFRAME_CELL, MARKDOWN_CELL])

        (request,), _ = run(source)

        assert request.name.root == PROJECT.id
        assert request.dataModelType == DataModelType.HexDataModel
        # The second cell shares the first one's label, and the dataframe cell reads no warehouse table
        assert [(column.name.root, column.dataType) for column in request.columns] == [
            ("Revenue by region", DataType.STRUCT),
            ("Revenue by region_2", DataType.STRUCT),
        ]
        assert [(child.name.root, child.dataType) for child in request.columns[0].children] == [
            ("region", DataType.VARCHAR),
            ("revenue", DataType.UNKNOWN),
            ("segment", DataType.VARCHAR),
        ]
        assert [child.name.root for child in request.columns[1].children] == ["id", "segment"]
        assert "-- Revenue by region\nselect o.region" in request.sql.root
        assert f"{SERVICE}.model.{PROJECT.id}" in source.datamodel_source_state

    def test_table_to_data_model_edges_carry_column_lineage(self, make_source):
        source = make_source([REVENUE_CELL, CUSTOMERS_CELL])

        _, edges = run(source)

        model_fqn = f"{SERVICE}.model.{PROJECT.id}"
        by_table = {edge.fromEntity.fullyQualifiedName: edge for edge in edges}
        assert set(by_table) == {"snowflake_prod.prod.sales.orders", "snowflake_prod.prod.sales.customers"}
        assert all(edge.toEntity.type == "dashboardDataModel" for edge in edges)
        assert column_lineage(by_table["snowflake_prod.prod.sales.orders"]) == {
            f"{model_fqn}.Revenue by region.region": ["snowflake_prod.prod.sales.orders.region"],
            f"{model_fqn}.Revenue by region.revenue": ["snowflake_prod.prod.sales.orders.amount"],
        }
        assert column_lineage(by_table["snowflake_prod.prod.sales.customers"]) == {
            f"{model_fqn}.Revenue by region.segment": ["snowflake_prod.prod.sales.customers.segment"],
            f"{model_fqn}.Revenue by region_2.id": ["snowflake_prod.prod.sales.customers.id"],
            f"{model_fqn}.Revenue by region_2.segment": ["snowflake_prod.prod.sales.customers.segment"],
        }
        # Each table is looked up once even though both cells read customers
        assert len(source.metadata.searches) == 2

    def test_without_data_models_tables_link_to_the_dashboard(self, make_source):
        source = make_source([REVENUE_CELL], include_data_models=False)

        data_models, edges = run(source)

        assert data_models == []
        assert {edge.toEntity.type for edge in edges} == {"dashboard"}
        assert len(edges) == 2
        assert all(edge.lineageDetails.columnsLineage is None for edge in edges)

    def test_each_prefix_only_draws_the_tables_found_under_it(self, make_source):
        prefixes = ["snowflake_prod.prod.sales", "postgres_prod"]
        source = make_source([REVENUE_CELL], prefixes=prefixes)

        _, edges = run(source, prefixes=prefixes)

        assert sorted(edge.fromEntity.fullyQualifiedName for edge in edges) == [
            "snowflake_prod.prod.sales.customers",
            "snowflake_prod.prod.sales.orders",
        ]
        assert "snowflake_prod.prod.sales.orders" in source.metadata.searches

    def test_prefix_on_another_database_finds_nothing(self, make_source):
        source = make_source([REVENUE_CELL], prefixes=["snowflake_prod.staging"])

        data_models, edges = run(source, prefixes=["snowflake_prod.staging"])

        assert edges == []
        # Columns are still known from the SQL, only their source tables are missing
        assert [child.name.root for child in data_models[0].columns[0].children] == ["region", "revenue", "segment"]

    def test_unreadable_cells_fall_back_to_the_warehouse_queries(self, make_source):
        source = make_source(None)
        warehouse_lineage = HexProjectLineage(project_id=PROJECT.id)
        warehouse_lineage.add_table(ORDERS_TABLE)
        source.hex_project_lineage = {PROJECT.id: warehouse_lineage}

        data_models, edges = run(source)

        assert data_models == []
        assert [(edge.fromEntity.fullyQualifiedName, edge.toEntity.type) for edge in edges] == [
            ("snowflake_prod.prod.sales.orders", "dashboard")
        ]

    def test_cells_are_fetched_once_per_project(self, make_source):
        source = make_source([REVENUE_CELL])

        run(source)

        source.client.get_project_cells.assert_called_once_with(PROJECT.id)

    def test_chained_cells_trace_back_to_the_warehouse(self, make_source):
        def sql_cell(cell_id, sql, variable, connection="conn_snowflake"):
            return Cell(
                id=cell_id,
                label=variable,
                cellType="SQL",
                dataConnectionId=connection,
                resultVariableName=variable,
                contents={"sqlCell": {"source": sql}},
            )

        source = make_source(
            [
                sql_cell("c1", "select * from sales.orders", "base_orders"),
                sql_cell("c2", "select region, sum(amount) as revenue from base_orders group by 1", "by_region"),
                # Dataframe SQL with an input parameter, reading the cell above
                sql_cell("c3", "select region, revenue, {{ goal }} as goal from by_region", "pacing", connection=None),
                # Dataframe SQL over a Python dataframe only: nothing reaches the warehouse
                sql_cell("c4", "select * from forecast_df", "forecast", connection=None),
            ]
        )

        (request,), (edge,) = run(source)

        assert [column.name.root for column in request.columns] == ["base_orders", "by_region", "pacing"]
        assert [(child.name.root, child.dataType) for child in request.columns[2].children] == [
            ("region", DataType.VARCHAR),
            ("revenue", DataType.UNKNOWN),
            ("goal", DataType.UNKNOWN),
        ]
        model_fqn = f"{SERVICE}.model.{PROJECT.id}"
        assert {
            to_column: from_columns
            for to_column, from_columns in column_lineage(edge).items()
            if ".pacing." in to_column
        } == {
            f"{model_fqn}.pacing.region": ["snowflake_prod.prod.sales.orders.region"],
            f"{model_fqn}.pacing.revenue": ["snowflake_prod.prod.sales.orders.amount"],
        }

    def test_dashboard_links_its_data_model(self, make_source):
        source = make_source([REVENUE_CELL])
        source.context.get.return_value = SimpleNamespace(dashboard_service=SERVICE, charts=[], dataModels=[PROJECT.id])

        (either,) = source.yield_dashboard(PROJECT)

        assert [model.root for model in either.right.dataModels] == [f"{SERVICE}.model.{PROJECT.id}"]

    def test_dashboard_links_no_data_model_when_they_are_off(self, make_source):
        source = make_source([REVENUE_CELL], include_data_models=False)
        source.context.get.return_value = SimpleNamespace(dashboard_service=SERVICE, charts=[], dataModels=[])

        (either,) = source.yield_dashboard(PROJECT)

        assert either.right.dataModels is None

    @pytest.mark.parametrize(
        "failure",
        ["cells unreadable", "data connections unreadable", "table search down"],
    )
    def test_a_failed_read_keeps_the_existing_data_model(self, make_source, failure):
        first_run = make_source([REVENUE_CELL])
        run(first_run)
        source = make_source(None if failure == "cells unreadable" else [REVENUE_CELL])
        if failure == "data connections unreadable":
            source.client.get_data_connections.return_value = None
        if failure == "table search down":
            source.metadata.search_error = ConnectionError("search unavailable")
        source.metadata.entities.update(first_run.metadata.entities)
        source.context.get.return_value = SimpleNamespace(dashboard_service=SERVICE, charts=[], dataModels=[])

        data_models, _ = run(source)
        (dashboard,) = source.yield_dashboard(PROJECT)

        model_fqn = f"{SERVICE}.model.{PROJECT.id}"
        # Not rewritten, still marked as seen so the run doesn't delete it, and still linked
        assert data_models == []
        assert model_fqn in source.datamodel_source_state
        assert [model.root for model in dashboard.right.dataModels] == [model_fqn]

    def test_a_table_name_matching_several_tables_gets_no_lineage(self, make_source):
        orders_in_dev = Table(
            id=uuid.uuid4(),
            name="orders",
            fullyQualifiedName="snowflake_dev.prod.sales.orders",
            columns=ORDERS_TABLE.columns,
        )
        source = make_source([REVENUE_CELL], tables=(ORDERS_TABLE, orders_in_dev, CUSTOMERS_TABLE))

        _, edges = run(source)

        assert [edge.fromEntity.fullyQualifiedName for edge in edges] == ["snowflake_prod.prod.sales.customers"]

    def test_a_table_in_two_prefixes_gets_no_lineage(self, make_source):
        prefixes = ["snowflake_dev", "snowflake_prod"]
        orders_in_dev = ORDERS_TABLE.model_copy(
            update={
                "id": uuid.uuid4(),
                "fullyQualifiedName": FullyQualifiedEntityName("snowflake_dev.prod.sales.orders"),
            }
        )
        source = make_source([REVENUE_CELL], prefixes=prefixes, tables=(orders_in_dev, ORDERS_TABLE, CUSTOMERS_TABLE))

        _, edges = run(source, prefixes=prefixes)

        assert [edge.fromEntity.fullyQualifiedName for edge in edges] == ["snowflake_prod.prod.sales.customers"]

    @pytest.mark.parametrize(
        "connection, prefixes, expected",
        [
            (DataConnection(id="conn_snowflake", name="Snowflake", type="snowflake"), None, []),
            (
                DataConnection(
                    id="conn_snowflake",
                    name="Snowflake",
                    type="snowflake",
                    connectionDetails={"snowflake": {"database": "prod", "schema": "sales"}},
                ),
                None,
                ["snowflake_prod.prod.sales.orders"],
            ),
            (
                DataConnection(id="conn_snowflake", name="Snowflake", type="snowflake"),
                ["snowflake_prod.prod.sales"],
                ["snowflake_prod.prod.sales.orders"],
            ),
        ],
        ids=["no schema anywhere", "connection default schema", "prefix schema"],
    )
    def test_a_bare_table_name_needs_a_schema(self, make_source, connection, prefixes, expected):
        cell = REVENUE_CELL.model_copy(
            update={"contents": CellContents(sqlCell=SqlCellContents(source="select region from orders"))}
        )
        source = make_source([cell], prefixes=prefixes)
        source.client.get_data_connections.return_value = {"conn_snowflake": connection}

        _, edges = run(source, prefixes=prefixes or (None,))

        assert [edge.fromEntity.fullyQualifiedName for edge in edges] == expected

    def test_query_history_adds_the_tables_cells_did_not_resolve(self, make_source):
        cell = REVENUE_CELL.model_copy(
            update={"contents": CellContents(sqlCell=SqlCellContents(source="select region from orders"))}
        )
        source = make_source([cell])
        warehouse_lineage = HexProjectLineage(project_id=PROJECT.id)
        warehouse_lineage.add_table(ORDERS_TABLE)
        source.hex_project_lineage = {PROJECT.id: warehouse_lineage}

        _, edges = run(source)

        assert [(edge.fromEntity.fullyQualifiedName, edge.toEntity.type) for edge in edges] == [
            ("snowflake_prod.prod.sales.orders", "dashboard")
        ]

    def test_names_are_made_valid_column_names(self, make_source):
        cell = REVENUE_CELL.model_copy(
            update={
                "label": "Revenue > target",
                "contents": CellContents(
                    sqlCell=SqlCellContents(source='select region as "region::code" from sales.orders')
                ),
            }
        )
        source = make_source([cell])

        (request,), _ = run(source)

        assert request.columns[0].name.root == "Revenue _ target"
        assert [child.name.root for child in request.columns[0].children] == ["region_code"]

    def test_chained_cell_reads_a_table_its_upstream_cell_found_by_connection_defaults(self, make_source):
        def sql_cell(cell_id, sql, variable, connection):
            return Cell(
                id=cell_id,
                label=variable,
                cellType="SQL",
                dataConnectionId=connection,
                resultVariableName=variable,
                contents={"sqlCell": {"source": sql}},
            )

        source = make_source(
            [
                sql_cell("c1", "select * from orders", "base_orders", "conn_snowflake"),
                sql_cell("c2", "select region from base_orders", "regions", None),
            ]
        )
        source.client.get_data_connections.return_value = {
            "conn_snowflake": DataConnection(
                id="conn_snowflake",
                name="Snowflake",
                type="snowflake",
                connectionDetails={"snowflake": {"database": "prod", "schema": "sales"}},
            )
        }

        _, (edge,) = run(source)

        assert column_lineage(edge)[f"{SERVICE}.model.{PROJECT.id}.regions.region"] == [
            "snowflake_prod.prod.sales.orders.region"
        ]

    def test_a_column_passed_through_keeps_its_tables_casing(self, make_source):
        events = make_table("events", {"createdAt": DataType.TIMESTAMP})
        cell = REVENUE_CELL.model_copy(
            update={"contents": CellContents(sqlCell=SqlCellContents(source='select "createdAt" from sales.events'))}
        )
        source = make_source([cell], tables=(events,))

        (request,), (edge,) = run(source)

        assert [(c.name.root, c.dataType) for c in request.columns[0].children] == [("createdAt", DataType.TIMESTAMP)]
        assert column_lineage(edge) == {
            f"{SERVICE}.model.{PROJECT.id}.Revenue by region.createdAt": ["snowflake_prod.prod.sales.events.createdAt"]
        }

    def test_column_names_stay_unique_once_made_valid(self, make_source):
        cell = REVENUE_CELL.model_copy(
            update={
                "contents": CellContents(
                    sqlCell=SqlCellContents(source='select region as "x::y", amount as "x_y" from sales.orders')
                )
            }
        )
        source = make_source([cell])

        (request,), _ = run(source)

        assert [child.name.root for child in request.columns[0].children] == ["x_y", "x_y_2"]

    def test_a_failed_data_model_lookup_does_not_fail_the_dashboard(self, make_source):
        source = make_source(None)
        source.metadata.get_by_name = MagicMock(side_effect=ConnectionError("server unavailable"))
        source.context.get.return_value = SimpleNamespace(dashboard_service=SERVICE, charts=[], dataModels=[])

        (dashboard,) = source.yield_dashboard(PROJECT)

        assert dashboard.right.dataModels == []


class TestHexApiClientCells:
    @pytest.fixture
    def client(self):
        client = HexApiClient.__new__(HexApiClient)
        client.client = MagicMock()
        return client

    def test_export_cells_come_flattened_in_notebook_order(self, client):
        client.client.post.return_value = {
            "content": """
cells:
  - cellType: COLLAPSIBLE
    cellLabel: Base Data
    config:
      cells:
        - cellId: c1
          cellType: SQL
          cellLabel: Opportunities
          config: {dataConnectionId: conn_1, resultVariableName: base_opptys, source: SELECT * FROM dim}
        - cellId: c2
          cellType: CODE
          config: {source: print(1)}
  - cellId: c3
    cellType: SQL
    cellLabel: Pacing
    config: {resultVariableName: pacing, source: SELECT * FROM base_opptys}
"""
        }

        cells = client.get_project_cells("proj_1")

        client.client.post.assert_called_once_with("/projects/export", json={"projectId": "proj_1"})
        assert [(c.id, c.label, c.dataConnectionId, c.resultVariableName, c.sql) for c in cells] == [
            ("c1", "Opportunities", "conn_1", "base_opptys", "SELECT * FROM dim"),
            ("c3", "Pacing", None, "pacing", "SELECT * FROM base_opptys"),
        ]

    def test_cells_api_is_the_fallback_when_export_is_not_allowed(self, client):
        client.client.post.side_effect = HTTPError(response=SimpleNamespace(status_code=403))
        client.client.get.return_value = {
            "values": [{"id": "c1", "cellType": "SQL", "contents": {"sqlCell": {"source": "SELECT 1"}}}],
            "pagination": None,
        }

        assert [cell.sql for cell in client.get_project_cells("proj_1")] == ["SELECT 1"]

    def test_none_when_neither_api_can_be_read(self, client):
        client.client.post.side_effect = HTTPError(response=SimpleNamespace(status_code=403))
        client.client.get.side_effect = Exception("403 Forbidden")

        assert client.get_project_cells("proj_1") is None

    def test_none_without_the_cells_api_on_a_transient_export_failure(self, client):
        """The cells API loses chained cells, so it must not stand in for a failed export"""
        client.client.post.side_effect = HTTPError(response=SimpleNamespace(status_code=500))

        assert client.get_project_cells("proj_1") is None
        client.client.get.assert_not_called()

    def test_data_connections_follow_pagination(self, client):
        client.client.get.side_effect = [
            {
                "values": [
                    {
                        "id": "conn_1",
                        "name": "Warehouse",
                        "type": "snowflake",
                        "connectionDetails": {"snowflake": {"database": "analytics", "warehouse": "wh"}},
                    }
                ],
                "pagination": {"after": "p2"},
            },
            {"values": [{"id": "conn_2", "name": "Lake", "type": "bigquery"}], "pagination": None},
        ]

        connections = client.get_data_connections()

        assert {key: (c.type, c.default_database, c.default_schema) for key, c in connections.items()} == {
            "conn_1": ("snowflake", "analytics", None),
            "conn_2": ("bigquery", None, None),
        }
        assert client.client.get.call_args_list[1].kwargs["data"] == {"limit": 100, "after": "p2"}

    def test_no_data_connections_when_the_api_fails(self, client):
        client.client.get.side_effect = HTTPError(response=SimpleNamespace(status_code=500))

        assert client.get_data_connections() is None

    def test_data_connections_the_token_cant_read_are_none_known(self, client):
        """Unread would keep every data model as it is forever: it can't be read on a retry either"""
        client.client.get.side_effect = HTTPError(response=SimpleNamespace(status_code=403))

        assert client.get_data_connections() == {}

    def test_rate_limited_requests_are_retried(self):
        client = HexApiClient(HexConnection(hostPort="https://app.hex.tech", token="token"))

        assert 429 in client.client.config.retry_codes
        assert 429 not in client.client.config.limit_codes
