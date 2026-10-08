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
PowerBI measures -> Metric entities, driven through the real data model and lineage stages.
"""

import copy
import uuid
from unittest.mock import patch

import pytest

from metadata.generated.schema.api.data.createDashboardDataModel import CreateDashboardDataModelRequest
from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.metric import Language, MetricType, Type, UnitOfMeasurement
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.metadataIngestion.workflow import OpenMetadataWorkflowConfig
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.models.ometa_lineage import OMetaFQNLineageRequest, OMetaLineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.powerbi.metrics import (
    build_metric_request,
    dax_aggregation,
    dax_references,
    measure_dimensions,
    metric_measures_parents_first,
    powerbi_metric_name,
)
from metadata.ingestion.source.dashboard.powerbi.models import (
    Dataflow,
    Dataset,
    Group,
    PowerBiColumns,
    PowerBiMeasures,
    PowerBiTable,
)

SERVICE = "powerbi_source_test"

CONFIG = {
    "source": {
        "type": "powerbi",
        "serviceName": SERVICE,
        "serviceConnection": {
            "config": {
                "type": "PowerBI",
                "clientId": "client_id",
                "clientSecret": "secret",
                "tenantId": "tenant_id",
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

# Listed before its parent on purpose: the server rejects a relatedMetrics entry naming a
# metric not yet written, so emission order must not follow measure order.
MARGIN = PowerBiMeasures(
    name="Margin %",
    expression="DIVIDE([Total Profit], [total sales])  // case differs on purpose",
    formatString="0.00%",
)
TOTAL_SALES = PowerBiMeasures(
    name="Total Sales",
    expression="CALCULATE(SUM('Fact Sales'[Amount]), 'Fact Sales'[Status] = \"[Closed]\")",
    description="Gross sales",
    formatString="\\$#,0.00",
)
TOTAL_PROFIT = PowerBiMeasures(name="Total Profit", expression="SUMX('Fact Sales', 'Fact Sales'[Profit])")
HELPER = PowerBiMeasures(name="Helper", expression="COUNTROWS('Fact Sales')", isHidden=True)

FACT_SALES = PowerBiTable(
    name="Fact Sales",
    columns=[
        PowerBiColumns(name="Amount", dataType="Double"),
        PowerBiColumns(name="Profit", dataType="Double"),
        PowerBiColumns(name="Status", dataType="String"),
        PowerBiColumns(name="Order Date", dataType="DateTime"),
        PowerBiColumns(name="RowNumber-2662979B", dataType="Int64", isHidden=True),
    ],
    measures=[MARGIN, TOTAL_SALES, TOTAL_PROFIT, HELPER],
)
DIM_REGION = PowerBiTable(name="Region", columns=[PowerBiColumns(name="Region", dataType="String")])
SALES_DATASET = Dataset(id="ds-sales", name="Sales Model", tables=[FACT_SALES, DIM_REGION])
EMPTY_DATASET = Dataset(id="ds-empty", name="No Measures", tables=[DIM_REGION])
DATAFLOW = Dataflow(objectId="df-1", name="Sales Flow")

MODEL_FQN = f"{SERVICE}.model.{SALES_DATASET.id}"


def _data_model_entity(datamodel_request: CreateDashboardDataModelRequest) -> DashboardDataModel:
    """The entity the server returns for a request, with FQNs on every nested column."""

    def with_fqns(columns: list[Column] | None, parent: str) -> list[Column]:
        result = []
        for column in columns or []:
            column_fqn = f"{parent}.{column.name.root}"
            result.append(
                column.model_copy(
                    update={
                        "fullyQualifiedName": column_fqn,
                        "children": with_fqns(column.children, column_fqn) or None,
                    }
                )
            )
        return result

    return DashboardDataModel(
        id=uuid.uuid4(),
        name=datamodel_request.name,
        fullyQualifiedName=MODEL_FQN,
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        dataModelType=datamodel_request.dataModelType,
        columns=with_fqns(datamodel_request.columns, MODEL_FQN),
    )


@pytest.fixture
def make_source():
    @patch("metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection")
    @patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection")
    def build(create_connection, test_connection, **source_config):
        create_connection.return_value.client = False
        test_connection.return_value = False
        config = copy.deepcopy(CONFIG)
        config["source"]["sourceConfig"]["config"].update(source_config)
        workflow_config = OpenMetadataWorkflowConfig.model_validate(config)
        source = PowerbiSource.create(
            config["source"], OpenMetadata(workflow_config.workflowConfig.openMetadataServerConfig)
        )
        source.context.get().__dict__["dashboard_service"] = SERVICE
        return source

    return build


def _run_workspace(source: PowerbiSource, datasets: list) -> tuple[list, list]:
    """Run the real data model stage, then the metric stage against what it produced."""
    workspace = Group(id="ws-1", name="Sales", type="Workspace", datasets=datasets)
    source.state.enter(workspace)
    source.context.get().__dict__["workspace"] = workspace
    datamodels = [either.right for either in source.yield_datamodel(workspace) if either.right is not None]
    entities = {model_str(request.name): _data_model_entity(request) for request in datamodels}
    with patch.object(
        source.metadata, "get_by_name", side_effect=lambda entity, fqn: entities.get(fqn.rsplit(".", 1)[-1])
    ):
        outputs = [either.right for either in source.yield_datamodel_metrics() if either.right is not None]
    return datamodels, outputs


def _metrics(outputs: list) -> list[CreateMetricRequest]:
    return [output for output in outputs if isinstance(output, CreateMetricRequest)]


def _edges(outputs: list) -> dict[tuple[str, str], OMetaFQNLineageRequest]:
    return {
        (output.lineage_request.from_entity_fqn, output.lineage_request.to_entity_fqn): output.lineage_request
        for output in outputs
        if isinstance(output, OMetaLineageRequest) and isinstance(output.lineage_request, OMetaFQNLineageRequest)
    }


def test_measure_maps_to_metric():
    request = build_metric_request(SERVICE, SALES_DATASET, TOTAL_SALES, [])

    assert request.displayName == "Total Sales"
    assert request.description.root == "Gross sales"
    assert request.metricType == MetricType.SUM
    assert request.unitOfMeasurement == UnitOfMeasurement.DOLLARS
    assert request.metricExpression.language == Language.External
    assert request.metricExpression.code == TOTAL_SALES.expression
    assert request.measures[0].aggregation == "SUM"


def test_metric_name_is_stable_and_scoped_to_service_and_dataset():
    name = powerbi_metric_name(SERVICE, SALES_DATASET.id, "Total Sales")

    assert name == powerbi_metric_name(SERVICE, SALES_DATASET.id, "Total Sales")
    assert name.startswith(f"{SERVICE}-")
    assert name != powerbi_metric_name("other_service", SALES_DATASET.id, "Total Sales")
    assert name != powerbi_metric_name(SERVICE, "other_dataset", "Total Sales")


def test_hidden_measures_are_skipped_and_parents_come_first():
    names = [measure.name for _, measure in metric_measures_parents_first(SALES_DATASET)]

    assert names == ["Total Profit", "Total Sales", "Margin %"]


def test_dimensions_are_visible_columns_of_the_tables_the_measure_reads():
    dimensions = measure_dimensions(SALES_DATASET, FACT_SALES, TOTAL_SALES)

    assert {(dim.name, dim.type) for dim in dimensions} == {
        ("Amount", Type.CATEGORICAL),
        ("Profit", Type.CATEGORICAL),
        ("Status", Type.CATEGORICAL),
        ("Order Date", Type.TIME),
    }


def test_metric_stage_emits_metrics_with_assets_and_lineage(make_source):
    _, outputs = _run_workspace(make_source(), [SALES_DATASET])

    metrics = _metrics(outputs)
    profit, sales, margin = (
        powerbi_metric_name(SERVICE, SALES_DATASET.id, m.name) for m in (TOTAL_PROFIT, TOTAL_SALES, MARGIN)
    )
    assert [metric.name.root for metric in metrics] == [profit, sales, margin]
    assert len({model_str(metric.assets.root[0].id) for metric in metrics}) == 1
    assert {related.root for related in metrics[2].relatedMetrics} == {profit, sales}
    assert metrics[2].unitOfMeasurement == UnitOfMeasurement.PERCENTAGE

    edges = _edges(outputs)
    assert set(edges) == {
        (profit, margin),
        (sales, margin),
        (MODEL_FQN, profit),
        (MODEL_FQN, sales),
        (MODEL_FQN, margin),
    }
    # The DAX's columns, which Table -> DataModel lineage already feeds, are the source.
    sales_columns = edges[(MODEL_FQN, sales)].lineage_details.columnsLineage[0]
    assert sales_columns.toColumn.root == sales
    assert {column.root for column in sales_columns.fromColumns} == {
        f"{MODEL_FQN}.Fact Sales.Amount",
        f"{MODEL_FQN}.Fact Sales.Status",
    }
    # A measure reading only other measures falls back to its own column.
    margin_columns = edges[(MODEL_FQN, margin)].lineage_details.columnsLineage[0]
    assert [column.root for column in margin_columns.fromColumns] == [f"{MODEL_FQN}.Fact Sales.Margin %"]


def test_measures_stay_data_model_columns(make_source):
    """Metric ingestion is additive: the data model keeps every measure, hidden ones included."""
    datamodels, _ = _run_workspace(make_source(), [SALES_DATASET])

    fact_sales = next(column for column in datamodels[0].columns if column.name.root == "Fact Sales")
    measure_columns = {
        child.name.root: child.dataType for child in fact_sales.children if child.dataType.value.startswith("MEASURE")
    }
    assert measure_columns == {
        "Margin %": DataType.MEASURE_VISIBLE,
        "Total Sales": DataType.MEASURE_VISIBLE,
        "Total Profit": DataType.MEASURE_VISIBLE,
        "Helper": DataType.MEASURE_HIDDEN,
    }


def test_metrics_disabled_by_default_through_the_lineage_stage(make_source):
    source = make_source(includeMetrics=False)
    workspace = Group(id="ws-1", name="Sales", type="Workspace", datasets=[SALES_DATASET])
    source.state.enter(workspace)
    source.context.get().__dict__["workspace"] = workspace
    with (
        patch.object(source, "yield_dashboard_lineage_details", return_value=[]),
        patch.object(source, "yield_datamodel_metrics") as metric_stage,
    ):
        list(source.yield_dashboard_lineage(workspace))

    metric_stage.assert_not_called()


def test_missing_data_model_and_non_dataset_models_emit_nothing(make_source):
    source = make_source()
    workspace = Group(
        id="ws-1", name="Sales", type="Workspace", datasets=[SALES_DATASET, EMPTY_DATASET], dataflows=[DATAFLOW]
    )
    source.state.enter(workspace)
    source.context.get().__dict__["workspace"] = workspace
    with patch.object(source.metadata, "get_by_name", return_value=None) as get_by_name:
        outputs = list(source.yield_datamodel_metrics())

    assert outputs == []
    # Only the dataset that has measures is looked up.
    assert get_by_name.call_count == 1


def test_filtered_out_dataset_emits_no_metrics(make_source):
    _, outputs = _run_workspace(make_source(dataModelFilterPattern={"excludes": ["^Sales Model$"]}), [SALES_DATASET])

    assert outputs == []


def test_metric_lineage_honors_override_lineage(make_source):
    _, outputs = _run_workspace(make_source(overrideLineage=True), [SALES_DATASET])

    edges = [output for output in outputs if isinstance(output, OMetaLineageRequest)]
    assert len(edges) == 5
    assert all(edge.override_lineage for edge in edges)


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("SUM(Sales[Amount])", "SUM"),
        ("DISTINCTCOUNT('Fact Sales'[Customer])", "DISTINCTCOUNT"),
        ("-- total\nSUMX(Sales, Sales[Qty] * Sales[Price])", "SUMX"),
        ("STDEV.P(Sales[Amount])", "STDEV.P"),
        ('CALCULATE(COUNTROWS(Sales), Sales[Status] = "Open (late)")', "COUNTROWS"),
        ("SUM(Sales[Amount (USD)])", "SUM"),
        ("SUM(Sales[Amount]) / MIN(Sales[Qty])", None),
        ("DIVIDE([Profit], [Sales])", None),
        ("VAR x = SUM(Sales[Amount]) RETURN x * 2", None),
        (None, None),
    ],
)
def test_dax_aggregation_only_when_the_whole_expression_is_one_aggregate(expression, expected):
    assert dax_aggregation(expression) == expected


def test_dax_references_ignore_strings_and_comments_and_unescape_names():
    expression = "/* [Ignored] */ 'Bob''s Table'[A]]B] + T[Col] + [Measure] & \"[Literal]\" // [Comment]"

    assert list(dax_references(expression)) == [("Bob's Table", "A]B"), ("T", "Col"), (None, "Measure")]
