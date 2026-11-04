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
Tableau calculated measures -> Metric entities, driven through the real lineage stage.
"""

import copy
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.metric import Language, MetricType, Type, UnitOfMeasurement
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.ometa_lineage import OMetaFQNLineageRequest, OMetaLineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.tableau.metadata import TableauSource
from metadata.ingestion.source.dashboard.tableau.metrics import (
    build_metric_request,
    datasource_dimensions,
    formula_aggregation,
    metric_fields_parents_first,
    tableau_metric_name,
)
from metadata.ingestion.source.dashboard.tableau.models import (
    DataSource,
    DatasourceField,
    TableAndQuery,
    TableauDashboard,
    TableauDatasource,
    UpstreamColumn,
    UpstreamTable,
    UpstreamTableColumn,
)

SERVICE = "tableau_source_test"

CONFIG = {
    "source": {
        "type": "tableau",
        "serviceName": SERVICE,
        "serviceConnection": {
            "config": {
                "type": "Tableau",
                "authType": {"username": "username", "password": "abcdefg"},
                "hostPort": "http://tableauHost.com",
                "siteName": "tableauSiteName",
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata", "includeMetrics": True}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

SALES = DatasourceField(
    id="f-sales",
    name="Sales",
    role="MEASURE",
    upstreamColumns=[UpstreamColumn(id="c-sales", name="sales")],
)
TOTAL_SALES = DatasourceField(
    id="f-total-sales",
    name="Total Sales",
    formula="SUM([Sales])",
    role="MEASURE",
    aggregation="Sum",
    defaultFormat='c"$"#,##0.00',
    description="Gross sales",
    upstreamColumns=[UpstreamColumn(id="c-sales", name="sales")],
)
# Listed before its parent on purpose: the server rejects a relatedMetrics entry naming a
# metric not yet written, so emission order must not follow field order.
MARGIN = DatasourceField(
    id="f-margin",
    name="Margin",
    formula="SUM([Profit]) / [Total Sales]",
    role="MEASURE",
    aggregation="User",
    defaultFormat="p0.00%",
    upstreamColumns=[UpstreamColumn(id="c-profit", name="profit"), UpstreamColumn(id="c-sales", name="sales")],
    upstreamFields=[TableauDatasource(id="f-total-sales"), TableauDatasource(id="f-profit")],
)
HIDDEN = DatasourceField(id="f-hidden", name="Helper", formula="SUM([Sales])", role="MEASURE", isHidden=True)
REGION = DatasourceField(id="f-region", name="Region", role="DIMENSION", dataType="STRING")
ORDER_DATE = DatasourceField(id="f-order-date", name="Order Date", role="DIMENSION", dataType="DATE")

PUBLISHED = DataSource(
    id="ds-published", name="Superstore", fields=[MARGIN, SALES, TOTAL_SALES, HIDDEN, REGION, ORDER_DATE]
)
# An embedded datasource on a published one reports the published fields bare -- no role.
EMBEDDED = DataSource(
    id="ds-embedded",
    name="Superstore (embedded)",
    fields=[DatasourceField(id="f-embedded-margin", name="Margin", formula="SUM([Profit]) / [Total Sales]")],
    upstreamDatasources=[PUBLISHED],
    upstreamTables=[
        UpstreamTable(
            id="t-orders",
            luid="t-orders-luid",
            name="orders",
            columns=[
                UpstreamTableColumn(id="c-sales", name="sales"),
                UpstreamTableColumn(id="c-profit", name="profit"),
            ],
        )
    ],
)

TABLE_FQN = "db.shop.public.orders"
ORDERS = Table(
    id=uuid.uuid4(),
    name="orders",
    fullyQualifiedName=TABLE_FQN,
    columns=[
        Column(name="sales", dataType=DataType.DOUBLE, fullyQualifiedName=f"{TABLE_FQN}.sales"),
        Column(name="profit", dataType=DataType.DOUBLE, fullyQualifiedName=f"{TABLE_FQN}.profit"),
    ],
)


def _data_model(datasource: DataSource) -> DashboardDataModel:
    model_fqn = f"{SERVICE}.model.{datasource.id}"
    return DashboardDataModel(
        id=uuid.uuid4(),
        name=datasource.id,
        fullyQualifiedName=model_fqn,
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        dataModelType="TableauPublishedDatasource",
        # One column per datasource field, named by field id, as `get_column_info` builds them.
        columns=[
            Column(name=field.id, dataType=DataType.RECORD, fullyQualifiedName=f"{model_fqn}.{field.id}")
            for field in datasource.fields or []
        ],
    )


DATA_MODELS = {datasource.id: _data_model(datasource) for datasource in (PUBLISHED, EMBEDDED)}


@pytest.fixture
def make_source():
    @patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection")
    @patch("metadata.ingestion.source.dashboard.tableau.connection.get_connection")
    def build(get_connection, test_connection, **source_config):
        get_connection.return_value = False
        test_connection.return_value = False
        config = copy.deepcopy(CONFIG)
        config["source"]["sourceConfig"]["config"].update(source_config)
        workflow_config = OpenMetadataWorkflowConfig.model_validate(config)
        source = TableauSource.create(
            config["source"], OpenMetadata(workflow_config.workflowConfig.openMetadataServerConfig)
        )
        source.client = SimpleNamespace(get_custom_sql_table_queries=MagicMock(return_value=[]))
        source.context.get().__dict__["dashboard_service"] = SERVICE
        source.context.get().__dict__["dataModels"] = []
        return source

    return build


def _run_lineage_stage(source: TableauSource) -> list:
    dashboard = TableauDashboard(id="wb-1", name="Sales Workbook", dataModels=[EMBEDDED])
    with (
        patch.object(source, "_get_datamodel", side_effect=lambda datamodel: DATA_MODELS.get(datamodel.id)),
        patch.object(source, "_get_database_tables", return_value=[TableAndQuery(table=ORDERS)]),
    ):
        return [either.right for either in source.yield_dashboard_lineage(dashboard) if either.right is not None]


def _metric_edges(outputs: list) -> list[OMetaLineageRequest]:
    return [
        output
        for output in outputs
        if isinstance(output, OMetaLineageRequest) and isinstance(output.lineage_request, OMetaFQNLineageRequest)
    ]


def test_calculated_measure_maps_to_metric():
    request = build_metric_request(SERVICE, PUBLISHED, TOTAL_SALES, datasource_dimensions(PUBLISHED))

    assert request.displayName == "Total Sales"
    assert request.metricType == MetricType.SUM
    assert request.unitOfMeasurement == UnitOfMeasurement.DOLLARS
    assert request.metricExpression.language == Language.External
    assert request.metricExpression.code == "SUM([Sales])"
    assert request.measures[0].aggregation == "Sum"
    assert {(dim.name, dim.type) for dim in request.dimensions} == {
        ("Region", Type.CATEGORICAL),
        ("Order Date", Type.TIME),
    }


def test_metric_name_is_stable_and_scoped_to_service_and_datasource():
    name = tableau_metric_name(SERVICE, PUBLISHED.id, TOTAL_SALES.id)

    assert name == tableau_metric_name(SERVICE, PUBLISHED.id, TOTAL_SALES.id)
    assert name.startswith(f"{SERVICE}-")
    assert name != tableau_metric_name("other_service", PUBLISHED.id, TOTAL_SALES.id)
    assert name != tableau_metric_name(SERVICE, "other_datasource", TOTAL_SALES.id)


def test_only_visible_calculated_measures_are_metrics_and_parents_come_first():
    """A plain numeric column is a measure by default, not an authored metric."""
    assert [field.id for field in metric_fields_parents_first(PUBLISHED)] == ["f-total-sales", "f-margin"]
    assert metric_fields_parents_first(EMBEDDED) == []


def test_lineage_stage_emits_metrics_with_assets_and_lineage(make_source):
    outputs = _run_lineage_stage(make_source())

    metrics = [output for output in outputs if isinstance(output, CreateMetricRequest)]
    total_sales_name = tableau_metric_name(SERVICE, PUBLISHED.id, TOTAL_SALES.id)
    margin_name = tableau_metric_name(SERVICE, PUBLISHED.id, MARGIN.id)
    assert [model.name.root for model in metrics] == [total_sales_name, margin_name]
    assert all(model.assets.root[0].id == DATA_MODELS[PUBLISHED.id].id for model in metrics)
    assert [related.root for related in metrics[1].relatedMetrics] == [total_sales_name]

    edges = {
        (edge.lineage_request.from_entity_fqn, edge.lineage_request.to_entity_fqn): edge.lineage_request
        for edge in _metric_edges(outputs)
    }
    model_fqn = DATA_MODELS[PUBLISHED.id].fullyQualifiedName.root
    assert set(edges) == {
        (total_sales_name, margin_name),
        (model_fqn, total_sales_name),
        (model_fqn, margin_name),
    }
    margin_edge = edges[(model_fqn, margin_name)]
    assert margin_edge.from_entity_type == "dashboardDataModel"
    margin_columns = margin_edge.lineage_details.columnsLineage[0]
    assert margin_columns.toColumn.root == margin_name
    assert [column.root for column in margin_columns.fromColumns] == [f"{model_fqn}.{MARGIN.id}"]


def test_metrics_disabled_by_default(make_source):
    outputs = _run_lineage_stage(make_source(includeMetrics=False))

    assert not [output for output in outputs if isinstance(output, CreateMetricRequest)]
    assert not _metric_edges(outputs)


def test_metric_lineage_honors_override_lineage(make_source):
    """The sink caches the delete per target, so every edge into a metric survives the override."""
    edges = _metric_edges(_run_lineage_stage(make_source(overrideLineage=True)))

    assert len(edges) == 3
    assert all(edge.override_lineage for edge in edges)


def test_missing_data_model_emits_no_metrics(make_source):
    source = make_source()
    dashboard = TableauDashboard(id="wb-1", name="Sales Workbook", dataModels=[EMBEDDED])
    with patch.object(source, "_get_datamodel", return_value=None):
        outputs = [either.right for either in source.yield_datamodel_metrics(dashboard)]

    assert outputs == []


def test_filtered_out_data_model_emits_no_metrics_even_if_it_exists_on_the_server(make_source):
    outputs = _run_lineage_stage(make_source(dataModelFilterPattern={"excludes": ["^Superstore$"]}))

    assert not [output for output in outputs if isinstance(output, CreateMetricRequest)]


@pytest.mark.parametrize(
    ("formula", "expected"),
    [
        ("COUNTD([User LUID])", "COUNTD"),
        ("// distinct users\nCOUNTD([User LUID])", "COUNTD"),
        ("SUM(IF [a] THEN ([b]) END)", "SUM"),
        ("SUM([Total Size (GB)])/MIN([Storage Quota (GB)])", None),
        ("{ FIXED : COUNTD([User Email])}", None),
        ("ROUND(TODAY()-[Last Accessed At])", None),
        (None, None),
    ],
)
def test_formula_aggregation_only_when_the_whole_formula_is_one_aggregate(formula, expected):
    assert formula_aggregation(formula) == expected


def test_metric_type_falls_back_to_the_formula_when_tableau_reports_no_aggregation():
    """Tableau Cloud returns aggregation=null for every calculated field."""
    field = DatasourceField(id="f-users", name="Users", formula="COUNTD([User LUID])", role="MEASURE")

    request = build_metric_request(SERVICE, PUBLISHED, field, [])

    assert request.metricType == MetricType.COUNT
    assert request.measures[0].aggregation == "COUNTD"
