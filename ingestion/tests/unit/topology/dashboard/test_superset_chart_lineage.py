#  Copyright 2026 Collate
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
Regression tests for the Superset Dashboard <-> DataModel <-> Chart linking
behaviour. Verifies:

1. yield_dashboard sends dataModels=[] on every CreateDashboardRequest, so
   stale Dashboard.dataModels entries from previous runs are cleared.

2. The Superset override of yield_datamodel_dashboard_lineage produces no
   edges, suppressing the base class' direct DataModel -> Dashboard edge.

3. yield_dashboard_lineage_details emits both DataModel -> Chart and
   Chart -> Dashboard edges so the lineage graph renders the chart as the
   bridge between datamodels and the dashboard.
"""

import uuid
from unittest import TestCase
from unittest.mock import MagicMock

from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard, DashboardType
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.dashboard.dashboard_service import (
    DashboardServiceSource,
)
from metadata.ingestion.source.dashboard.superset.api_source import SupersetAPISource
from metadata.ingestion.source.dashboard.superset.db_source import SupersetDBSource
from metadata.ingestion.source.dashboard.superset.mixin import SupersetSourceMixin
from metadata.ingestion.source.dashboard.superset.models import (
    DashboardResult,
    FetchChart,
    FetchDashboard,
)


def _make_dashboard_entity() -> Dashboard:
    return Dashboard(
        id=uuid.uuid4(),
        name=EntityName("4"),
        fullyQualifiedName=FullyQualifiedEntityName("superset_test.4"),
        dashboardType=DashboardType.Dashboard,
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
    )


def _make_chart_entity(chart_id: str) -> Chart:
    return Chart(
        id=uuid.uuid4(),
        name=EntityName(chart_id),
        fullyQualifiedName=FullyQualifiedEntityName(f"superset_test.{chart_id}"),
        chartType=ChartType.Table,
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
    )


def _make_datamodel_entity(datamodel_id: str) -> DashboardDataModel:
    return DashboardDataModel(
        id=uuid.uuid4(),
        name=EntityName(datamodel_id),
        fullyQualifiedName=FullyQualifiedEntityName(
            f"superset_test.model.{datamodel_id}"
        ),
        dataModelType=DataModelType.SupersetDataModel,
        columns=[],
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
    )


def _build_context(charts=None, datamodels=None) -> MagicMock:
    ctx = MagicMock()
    ctx.dashboard_service = "superset_test"
    ctx.charts = charts or []
    ctx.dataModels = datamodels or []
    return ctx


class TestSupersetDashboardDataModelsCleared(TestCase):
    """yield_dashboard must send dataModels=[] (not omit) so server clears
    any stale Dashboard.dataModels entries persisted from earlier runs."""

    def test_db_source_yields_empty_data_models(self):
        source = SupersetDBSource.__new__(SupersetDBSource)
        source.metadata = MagicMock()
        source.service_connection = MagicMock(hostPort="https://superset.example.com")
        source.context = MagicMock()
        source.context.get.return_value = _build_context(
            charts=["10", "11"], datamodels=["45", "46"]
        )
        source.get_owner_ref = MagicMock(return_value=None)

        dashboard_details = FetchDashboard(
            id=4,
            dashboard_title="Meltano",
            position_json=None,
            published=True,
            email=None,
            json_metadata=None,
        )

        results = list(SupersetDBSource.yield_dashboard(source, dashboard_details))
        self.assertEqual(len(results), 1)
        request: CreateDashboardRequest = results[0].right
        # The whole point of the regression fix: dataModels MUST be an empty
        # list, not None or absent — that's what tells the server to clear
        # the field.
        self.assertEqual(request.dataModels, [])
        self.assertEqual(len(request.charts), 2)

    def test_api_source_yields_empty_data_models(self):
        source = SupersetAPISource.__new__(SupersetAPISource)
        source.metadata = MagicMock()
        source.service_connection = MagicMock(hostPort="https://superset.example.com")
        source.context = MagicMock()
        source.context.get.return_value = _build_context(
            charts=["10"], datamodels=["45"]
        )
        source.get_owner_ref = MagicMock(return_value=None)

        dashboard_details = DashboardResult(
            id=4,
            dashboard_title="Meltano",
            url="/dashboard/4/",
            published=True,
            position_json=None,
            email=None,
            json_metadata=None,
        )

        results = list(SupersetAPISource.yield_dashboard(source, dashboard_details))
        self.assertEqual(len(results), 1)
        request: CreateDashboardRequest = results[0].right
        self.assertEqual(request.dataModels, [])
        self.assertEqual(len(request.charts), 1)


class TestSupersetSuppressesDirectDataModelDashboardEdge(TestCase):
    """The Superset mixin must override yield_datamodel_dashboard_lineage to
    emit zero edges — otherwise the base class produces a direct
    DataModel -> Dashboard lineage edge that bypasses the chart node."""

    def test_override_yields_no_edges(self):
        source = MagicMock()
        # Bind the unbound method to the mock so the override runs
        result = list(
            SupersetSourceMixin.yield_datamodel_dashboard_lineage(source)
        )
        self.assertEqual(result, [])


class TestSupersetEmitsChartBridgeEdges(TestCase):
    """yield_dashboard_lineage_details must emit DataModel -> Chart and
    Chart -> Dashboard edges so the chart bridges the chain in the
    lineage graph."""

    def _make_source(self, chart_entity, datamodel_entity, dashboard_entity):
        source = MagicMock()
        # Real bound methods we want to exercise
        source.yield_dashboard_lineage_details = (
            lambda *a, **kw: SupersetSourceMixin.yield_dashboard_lineage_details(
                source, *a, **kw
            )
        )
        source._get_chart_entity = lambda chart_json: chart_entity
        source._get_dashboard_entity = lambda dashboard_details: dashboard_entity
        source._get_dashboard_data_model_entity = lambda chart_json: datamodel_entity
        source._get_input_tables = lambda chart_json: []
        source._enrich_raw_input_tables = lambda inputs, to_entity, prefix: []
        source._get_charts_of_dashboard = lambda dashboard_details: ["10"]
        source._get_add_lineage_request = DashboardServiceSource._get_add_lineage_request
        source.all_charts = {
            "10": FetchChart(
                id=10,
                slice_name="chart-10",
                datasource_id=45,
                viz_type="table",
                table_name="t",
                table_id=1,
                table_schema=None,
                schema_name=None,
                sql=None,
                params=None,
                description=None,
                url=None,
            )
        }
        return source

    def test_chart_bridge_edges_emitted(self):
        chart = _make_chart_entity("10")
        datamodel = _make_datamodel_entity("45")
        dashboard = _make_dashboard_entity()
        source = self._make_source(chart, datamodel, dashboard)

        dashboard_details = FetchDashboard(
            id=4,
            dashboard_title="Meltano",
            position_json=None,
            published=True,
            email=None,
            json_metadata=None,
        )
        results = [
            r for r in source.yield_dashboard_lineage_details(dashboard_details)
            if r is not None and r.right is not None
        ]

        edges = [r.right for r in results if isinstance(r.right, AddLineageRequest)]
        self.assertEqual(len(edges), 2, f"expected 2 edges, got {edges}")

        from_to = {(e.edge.fromEntity.id.root, e.edge.toEntity.id.root) for e in edges}
        self.assertIn(
            (datamodel.id.root, chart.id.root),
            from_to,
            "DataModel -> Chart edge missing",
        )
        self.assertIn(
            (chart.id.root, dashboard.id.root),
            from_to,
            "Chart -> Dashboard edge missing",
        )

    def test_no_chart_entity_skips_bridge_edges(self):
        # When the Chart entity isn't yet visible on the server, both bridge
        # edges should be skipped (no crash, just no emission).
        datamodel = _make_datamodel_entity("45")
        source = self._make_source(
            chart_entity=None, datamodel_entity=datamodel, dashboard_entity=None
        )
        dashboard_details = FetchDashboard(
            id=4,
            dashboard_title="Meltano",
            position_json=None,
            published=True,
            email=None,
            json_metadata=None,
        )
        results = [
            r for r in source.yield_dashboard_lineage_details(dashboard_details)
            if r is not None and r.right is not None
        ]
        edges = [r.right for r in results if isinstance(r.right, AddLineageRequest)]
        self.assertEqual(edges, [], "no edges should be emitted without chart entity")
