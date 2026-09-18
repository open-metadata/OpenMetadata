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
Test Grafana Dashboard using the topology
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.dashboard.grafana.metadata import GrafanaSource
from metadata.ingestion.source.dashboard.grafana.models import (
    GrafanaDashboard,
    GrafanaDashboardMeta,
    GrafanaDashboardResponse,
    GrafanaDatasource,
    GrafanaFolder,
    GrafanaPanel,
    GrafanaSearchResult,
    GrafanaTarget,
)

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_grafana"),
    name="mock_grafana",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Grafana,
)

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_postgres"),
    name="mock_postgres",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Postgres,
)

EXAMPLE_DASHBOARD = LineageDashboard(
    id="7b3766b1-7eb4-4ad4-b7c8-15a8b16edfdd",
    name="test-dashboard-uid",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="dashboardService"),
)

EXAMPLE_TABLE = [
    Table(
        id="0bd6bd6f-7fea-4a98-98c7-3b37073629c7",
        name="customers",
        fullyQualifiedName="mock_postgres.public.customers",
        columns=[],
    )
]

mock_config = {
    "source": {
        "type": "grafana",
        "serviceName": "mock_grafana",
        "serviceConnection": {
            "config": {
                "type": "Grafana",
                "hostPort": "https://grafana.example.com",
                "apiKey": "test_api_key",
                "verifySSL": True,
                "pageSize": 100,
            }
        },
        "sourceConfig": {
            "config": {
                "dashboardFilterPattern": {},
                "chartFilterPattern": {},
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "loggerLevel": "DEBUG",
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
        },
    },
}

MOCK_FOLDERS = [
    GrafanaFolder(
        id=1,
        uid="folder-1",
        title="Marketing",
        created="2024-01-01T00:00:00Z",
    ),
    GrafanaFolder(
        id=2,
        uid="folder-2",
        title="Sales",
        created="2024-01-02T00:00:00Z",
    ),
]

MOCK_SEARCH_RESULTS = [
    GrafanaSearchResult(
        id=1,
        uid="test-dashboard-uid",
        title="Test Dashboard",
        uri="db/test-dashboard",
        url="/d/test-dashboard-uid/test-dashboard",
        slug="test-dashboard",
        type="dash-db",
        tags=["production", "analytics"],
        isStarred=False,
        folderId=1,
        folderUid="folder-1",
        folderTitle="Marketing",
        folderUrl="/dashboards/f/folder-1/marketing",
    ),
    GrafanaSearchResult(
        id=2,
        uid="sales-dashboard-uid",
        title="Sales Dashboard",
        uri="db/sales-dashboard",
        url="/d/sales-dashboard-uid/sales-dashboard",
        slug="sales-dashboard",
        type="dash-db",
        tags=["sales", "kpi"],
        isStarred=True,
        folderId=2,
        folderUid="folder-2",
        folderTitle="Sales",
        folderUrl="/dashboards/f/folder-2/sales",
    ),
]

MOCK_PANELS = [
    GrafanaPanel(
        id=1,
        type="graph",
        title="User Activity",
        description="Shows user activity over time",
        datasource={"uid": "postgres-uid", "type": "postgres"},
        targets=[
            GrafanaTarget(
                refId="A",
                datasource={"uid": "postgres-uid", "type": "postgres"},
                rawSql="SELECT date_trunc('hour', created_at) as time, COUNT(*) as value FROM customers WHERE created_at > now() - interval '24 hours' GROUP BY 1",
            )
        ],
    ),
    GrafanaPanel(
        id=2,
        type="table",
        title="Top Customers",
        datasource={"uid": "postgres-uid", "type": "postgres"},
        targets=[
            GrafanaTarget(
                refId="A",
                datasource={"uid": "postgres-uid", "type": "postgres"},
                rawSql="SELECT name, email, total_orders FROM customers ORDER BY total_orders DESC LIMIT 10",
            )
        ],
    ),
    GrafanaPanel(
        id=3,
        type="stat",
        title="Total Revenue",
        datasource={"uid": "prometheus-uid", "type": "prometheus"},
        targets=[
            GrafanaTarget(
                refId="A",
                datasource={"uid": "prometheus-uid", "type": "prometheus"},
                expr="sum(rate(revenue_total[5m]))",
            )
        ],
    ),
    GrafanaPanel(
        id=4,
        type="row",  # expanded row — no nested panels, skipped by consumer
        title="Row Panel",
    ),
]

MOCK_DASHBOARD_RESPONSE = GrafanaDashboardResponse(
    dashboard=GrafanaDashboard(
        id=1,
        uid="test-dashboard-uid",
        title="Test Dashboard",
        tags=["production", "analytics"],
        panels=MOCK_PANELS,
        description="Test dashboard description",
        version=5,
    ),
    meta=GrafanaDashboardMeta(
        type="db",
        canSave=True,
        canEdit=True,
        canAdmin=True,
        canStar=True,
        canDelete=True,
        slug="test-dashboard",
        url="/d/test-dashboard-uid/test-dashboard",
        created="2024-01-01T00:00:00Z",
        updated="2024-01-15T00:00:00Z",
        updatedBy="admin@example.com",
        createdBy="admin@example.com",
        version=5,
        folderId=1,
        folderUid="folder-1",
        folderTitle="Marketing",
        folderUrl="/dashboards/f/folder-1/marketing",
    ),
)

MOCK_DATASOURCES = [
    GrafanaDatasource(
        id=1,
        uid="postgres-uid",
        name="PostgreSQL",
        type="postgres",
        url="postgres:5432",
        database="production",
        isDefault=True,
    ),
    GrafanaDatasource(
        id=2,
        uid="prometheus-uid",
        name="Prometheus",
        type="prometheus",
        url="http://prometheus:9090",
        isDefault=False,
    ),
]

EXPECTED_DASHBOARD = CreateDashboardRequest(
    name=EntityName("test-dashboard-uid"),
    displayName="Test Dashboard",
    description=Markdown("Test dashboard description"),
    sourceUrl=SourceUrl("https://grafana.example.com/d/test-dashboard-uid/test-dashboard"),
    charts=[],
    service=FullyQualifiedEntityName("mock_grafana"),
    tags=[],
    owners=None,
)

EXPECTED_CHARTS = [
    CreateChartRequest(
        name=EntityName("test-dashboard-uid_1"),
        displayName="User Activity",
        description=Markdown("Shows user activity over time"),
        chartType="Line",
        sourceUrl=SourceUrl("https://grafana.example.com/d/test-dashboard-uid/test-dashboard?viewPanel=1"),
        service=FullyQualifiedEntityName("mock_grafana"),
    ),
    CreateChartRequest(
        name=EntityName("test-dashboard-uid_2"),
        displayName="Top Customers",
        description=None,
        chartType="Table",
        sourceUrl=SourceUrl("https://grafana.example.com/d/test-dashboard-uid/test-dashboard?viewPanel=2"),
        service=FullyQualifiedEntityName("mock_grafana"),
    ),
    CreateChartRequest(
        name=EntityName("test-dashboard-uid_3"),
        displayName="Total Revenue",
        description=None,
        chartType="Text",
        sourceUrl=SourceUrl("https://grafana.example.com/d/test-dashboard-uid/test-dashboard?viewPanel=3"),
        service=FullyQualifiedEntityName("mock_grafana"),
    ),
]

# ---------------------------------------------------------------------------
# Collapsed-row fixtures
# Two charts nested inside a collapsed row panel (id=20).
# ---------------------------------------------------------------------------
MOCK_COLLAPSED_PANELS = [
    GrafanaPanel(
        id=21,
        type="graph",
        title="Nested Chart A",
        datasource={"uid": "postgres-uid", "type": "postgres"},
        targets=[
            GrafanaTarget(
                refId="A",
                datasource={"uid": "postgres-uid", "type": "postgres"},
                rawSql="SELECT date_trunc('day', ts) AS day, SUM(amount) FROM orders GROUP BY 1",
            )
        ],
    ),
    GrafanaPanel(
        id=22,
        type="table",
        title="Nested Chart B",
        datasource={"uid": "postgres-uid", "type": "postgres"},
        targets=[
            GrafanaTarget(
                refId="A",
                datasource={"uid": "postgres-uid", "type": "postgres"},
                rawSql="SELECT product_id, SUM(qty) FROM order_items GROUP BY 1",
            )
        ],
    ),
]

MOCK_COLLAPSED_ROW = GrafanaPanel(
    id=20,
    type="row",
    title="Hidden Metrics",
    collapsed=True,
    panels=MOCK_COLLAPSED_PANELS,
)

# Dashboard whose top-level panels include an expanded row (id=4, no children)
# and a collapsed row (id=20) that wraps two charts.
MOCK_DASHBOARD_WITH_COLLAPSED_ROW = GrafanaDashboardResponse(
    dashboard=GrafanaDashboard(
        id=2,
        uid="test-dashboard-uid",
        title="Test Dashboard",
        tags=["production"],
        panels=[
            MOCK_PANELS[0],  # graph  (id=1)
            MOCK_PANELS[1],  # table  (id=2)
            MOCK_PANELS[3],  # expanded row (id=4) — kept as-is, skipped by consumer
            MOCK_COLLAPSED_ROW,  # collapsed row (id=20) → exposes charts 21 and 22
        ],
        description="Test with collapsed rows",
        version=6,
    ),
    meta=MOCK_DASHBOARD_RESPONSE.meta,
)


class TestGrafana:
    """Unit tests for the Grafana dashboard connector."""

    @pytest.fixture(autouse=True)
    def setup(self):
        with (
            patch("metadata.ingestion.source.dashboard.dashboard_service.run_test_connection"),
            patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection") as create_connection,
        ):
            mock_client = MagicMock()
            mock_client.get_folders.return_value = MOCK_FOLDERS
            mock_client.search_dashboards.return_value = MOCK_SEARCH_RESULTS
            mock_client.get_dashboard.return_value = MOCK_DASHBOARD_RESPONSE
            mock_client.get_datasources.return_value = MOCK_DATASOURCES
            create_connection.return_value.client = mock_client

            with patch("metadata.ingestion.ometa.ometa_api.OpenMetadata") as mock_om:
                mock_metadata = MagicMock()
                mock_metadata.get_by_name.return_value = None
                mock_metadata.get_reference_by_email.return_value = None
                mock_om.return_value = mock_metadata

                self.grafana: GrafanaSource = GrafanaSource.create(
                    mock_config["source"],
                    mock_metadata,
                )

            self.grafana.client = MagicMock()
            self.grafana.client.get_folders.return_value = MOCK_FOLDERS
            self.grafana.client.search_dashboards.return_value = MOCK_SEARCH_RESULTS
            self.grafana.client.get_dashboard.return_value = MOCK_DASHBOARD_RESPONSE
            self.grafana.client.get_datasources.return_value = MOCK_DATASOURCES

            self.grafana.context.get().__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
            self.grafana.context.get().__dict__["charts"] = []

            yield

    # -----------------------------------------------------------------------
    # Core connector tests
    # -----------------------------------------------------------------------

    def test_prepare(self):
        """Test prepare method fetches folders, dashboards, and datasources."""
        self.grafana.prepare()

        assert len(self.grafana.folders) == 0
        assert len(self.grafana.dashboards) == 0
        # We store datasources by both UID and name, so 2 datasources = 4 entries
        assert len(self.grafana.datasources) == 4
        assert "PostgreSQL" in self.grafana.datasources
        assert len(getattr(self.grafana, "tags", set())) == 0

    def test_get_dashboard_name(self):
        """Test dashboard name extraction."""
        dashboard = MagicMock()
        dashboard.uid = "test-uid"
        assert self.grafana.get_dashboard_name(dashboard) == "test-uid"

    def test_get_dashboard_details(self):
        """Test fetching dashboard details."""
        dashboard = MagicMock()
        dashboard.uid = "test-dashboard-uid"
        details = self.grafana.get_dashboard_details(dashboard)
        assert details is not None
        assert details.dashboard.uid == "test-dashboard-uid"

    def test_yield_dashboard(self):
        """Test dashboard creation."""
        results = list(self.grafana.yield_dashboard(MOCK_DASHBOARD_RESPONSE))

        assert len(results) == 1
        assert isinstance(results[0], Either)

        dashboard = results[0].right
        assert dashboard.name == EntityName("test-dashboard-uid")
        assert dashboard.displayName == "Test Dashboard"
        assert dashboard.description == Markdown("Test dashboard description")
        assert "/d/test-dashboard-uid/test-dashboard" in dashboard.sourceUrl.root
        assert dashboard.service == FullyQualifiedEntityName("mock_grafana")

    def test_yield_dashboard_without_folder(self):
        """Test dashboard creation without folder."""
        dashboard_response = GrafanaDashboardResponse(
            dashboard=MOCK_DASHBOARD_RESPONSE.dashboard,
            meta=GrafanaDashboardMeta(**{**MOCK_DASHBOARD_RESPONSE.meta.model_dump(), "folderTitle": None}),
        )

        results = list(self.grafana.yield_dashboard(dashboard_response))
        dashboard = results[0].right
        assert dashboard.displayName == "Test Dashboard"

    # -----------------------------------------------------------------------
    # Chart ingestion — expanded-row regression + collapsed-row behaviour
    # -----------------------------------------------------------------------

    def test_yield_dashboard_chart(self):
        """Flat panels are yielded; expanded row panels (type='row') are skipped."""
        charts = [r.right for r in self.grafana.yield_dashboard_chart(MOCK_DASHBOARD_RESPONSE) if r.right]

        # Panels 1, 2, 3 → charts; panel 4 (expanded row) → skipped
        assert len(charts) == 3

        for expected, actual in zip(EXPECTED_CHARTS, charts, strict=False):
            assert expected.name == actual.name
            assert expected.displayName == actual.displayName
            assert expected.chartType == actual.chartType
            assert expected.service == actual.service

    def test_yield_dashboard_chart_expanded_row_is_not_yielded(self):
        """Regression: expanded row panels are never surfaced as charts."""
        charts = [r.right for r in self.grafana.yield_dashboard_chart(MOCK_DASHBOARD_RESPONSE) if r.right]
        names = {c.name.root for c in charts}
        assert "test-dashboard-uid_4" not in names

    def test_yield_dashboard_chart_collapsed_row_panels_are_yielded(self):
        """Charts nested inside a collapsed row are yielded; the row wrapper is not."""
        charts = [r.right for r in self.grafana.yield_dashboard_chart(MOCK_DASHBOARD_WITH_COLLAPSED_ROW) if r.right]
        names = {c.name.root for c in charts}

        # Nested panels from the collapsed row must appear.
        assert "test-dashboard-uid_21" in names, "Panel 21 nested in collapsed row must be yielded"
        assert "test-dashboard-uid_22" in names, "Panel 22 nested in collapsed row must be yielded"

        # Neither the collapsed-row wrapper nor the expanded row must appear as a chart.
        assert "test-dashboard-uid_20" not in names, "Collapsed row wrapper must not appear as a chart"
        assert "test-dashboard-uid_4" not in names, "Expanded row must not appear as a chart"

        # Total: panels 1 and 2 from MOCK_PANELS plus panels 21 and 22 from collapsed row = 4
        assert len(charts) == 4

    # -----------------------------------------------------------------------
    # Lineage — collapsed-row behaviour
    # -----------------------------------------------------------------------

    def test_yield_dashboard_lineage_collapsed_row_panels_contribute(self):
        """Panels nested inside a collapsed row are processed for lineage; the row wrapper is not."""
        self.grafana.metadata.get_by_name = MagicMock(return_value=EXAMPLE_DASHBOARD)

        with patch.object(
            GrafanaSource,
            "_process_panel_lineage",
            side_effect=lambda *args, **kwargs: iter([]),
        ) as mock_process:
            list(self.grafana.yield_dashboard_lineage_details(MOCK_DASHBOARD_WITH_COLLAPSED_ROW, "mock_postgres"))

        processed_panel_ids = {call.kwargs["panel"].id for call in mock_process.call_args_list}
        assert 21 in processed_panel_ids, "Panel 21 (nested in collapsed row) must be processed for lineage"
        assert 22 in processed_panel_ids, "Panel 22 (nested in collapsed row) must be processed for lineage"
        # The row wrapper must never reach the lineage processor.
        assert 20 not in processed_panel_ids, "Collapsed row wrapper (id=20) must not be passed to lineage"

    # -----------------------------------------------------------------------
    # Helpers and mapping
    # -----------------------------------------------------------------------

    def test_panel_type_mapping(self):
        """Test Grafana panel type to OpenMetadata chart type mapping."""
        test_cases = {
            "graph": "Line",
            "timeseries": "Line",
            "table": "Table",
            "stat": "Text",
            "gauge": "Gauge",
            "bargauge": "Bar",
            "bar": "Bar",
            "piechart": "Pie",
            "heatmap": "Heatmap",
            "histogram": "Histogram",
            "geomap": "Map",
            "nodeGraph": "Graph",
            "unknown": "Other",
        }

        for panel_type, expected_chart_type in test_cases.items():
            result = self.grafana._map_panel_type_to_chart_type(panel_type)
            assert result.value == expected_chart_type

    def test_extract_datasource_name(self):
        """Test datasource name extraction from different formats."""
        panel = GrafanaPanel(id=1, type="graph", title="Test")

        target = GrafanaTarget(datasource="postgres-uid")
        assert self.grafana._extract_datasource_name(target, panel) == "postgres-uid"

        target = GrafanaTarget(datasource={"uid": "postgres-uid", "type": "postgres"})
        assert self.grafana._extract_datasource_name(target, panel) == "postgres-uid"

        target = GrafanaTarget()
        panel_with_ds = GrafanaPanel(id=1, type="graph", title="Test", datasource="panel-datasource")
        assert self.grafana._extract_datasource_name(target, panel_with_ds) == "panel-datasource"

    def test_extract_sql_query(self):
        """Test SQL query extraction based on datasource type."""
        postgres_ds = GrafanaDatasource(
            id=1,
            uid="postgres-uid",
            name="PostgreSQL",
            type="grafana-postgresql-datasource",
            url="postgres:5432",
            database="production",
            isDefault=True,
        )
        prometheus_ds = MOCK_DATASOURCES[1]

        target = GrafanaTarget(rawSql="SELECT * FROM customers")
        assert self.grafana._extract_sql_query(target, postgres_ds) == "SELECT * FROM customers"

        target = GrafanaTarget(expr="up{job='prometheus'}")
        assert self.grafana._extract_sql_query(target, prometheus_ds) is None

    def test_get_owner_ref(self):
        """Test owner reference extraction."""
        mock_owner = EntityReference(id=str(uuid.uuid4()), type="user")
        self.grafana.metadata.get_reference_by_email = MagicMock(return_value=mock_owner)

        owner_ref = self.grafana.get_owner_ref(MOCK_DASHBOARD_RESPONSE)
        assert owner_ref is not None

        dashboard_response = GrafanaDashboardResponse(
            dashboard=MOCK_DASHBOARD_RESPONSE.dashboard,
            meta=GrafanaDashboardMeta(**{**MOCK_DASHBOARD_RESPONSE.meta.model_dump(), "createdBy": None}),
        )
        assert self.grafana.get_owner_ref(dashboard_response) is None

    def test_complete_json_parsing(self):
        """Test complete JSON parsing from raw dict through all nested levels."""
        complete_json = {
            "dashboard": {
                "id": 123,
                "uid": "complete-test-uid",
                "title": "Complete Test Dashboard",
                "tags": ["test", "integration"],
                "description": "Full integration test dashboard",
                "version": 10,
                "panels": [
                    {
                        "id": 1,
                        "type": "graph",
                        "title": "SQL Query Panel",
                        "description": "Panel with SQL query",
                        "datasource": {"uid": "postgres-ds", "type": "postgres"},
                        "targets": [
                            {
                                "refId": "A",
                                "datasource": {
                                    "uid": "postgres-ds",
                                    "type": "postgres",
                                },
                                "rawSql": "SELECT * FROM users WHERE created_at > now() - interval '1 day'",
                                "format": "time_series",
                            },
                            {
                                "refId": "B",
                                "datasource": {
                                    "uid": "postgres-ds",
                                    "type": "postgres",
                                },
                                "rawSql": "SELECT COUNT(*) FROM orders",
                                "format": 0,
                            },
                        ],
                    },
                    {
                        "id": 2,
                        "type": "stat",
                        "title": "Prometheus Panel",
                        "datasource": "prometheus-ds",
                        "targets": [
                            {
                                "refId": "A",
                                "datasource": "prometheus-ds",
                                "expr": "rate(http_requests_total[5m])",
                                "format": None,
                            }
                        ],
                    },
                ],
            },
            "meta": {
                "type": "db",
                "canSave": True,
                "canEdit": True,
                "canAdmin": False,
                "canStar": True,
                "canDelete": False,
                "slug": "complete-test-dashboard",
                "url": "/d/complete-test-uid/complete-test-dashboard",
                "created": "2024-01-01T00:00:00Z",
                "updated": "2024-02-01T12:30:00Z",
                "updatedBy": "user@example.com",
                "createdBy": "admin@example.com",
                "version": 10,
                "folderId": 5,
                "folderUid": "test-folder",
                "folderTitle": "Test Folder",
                "folderUrl": "/dashboards/f/test-folder/test-folder",
            },
        }

        parsed_response = GrafanaDashboardResponse(**complete_json)

        dashboard = parsed_response.dashboard
        assert dashboard.uid == "complete-test-uid"
        assert dashboard.title == "Complete Test Dashboard"
        assert dashboard.tags == ["test", "integration"]
        assert dashboard.version == 10
        assert len(dashboard.panels) == 2

        # Panel 0: SQL panel with a dict datasource and two nested targets.
        sql_panel = dashboard.panels[0]
        assert sql_panel.type == "graph"
        assert sql_panel.datasource == {"uid": "postgres-ds", "type": "postgres"}
        assert len(sql_panel.targets) == 2
        assert sql_panel.targets[0].rawSql.startswith("SELECT * FROM users")
        assert sql_panel.targets[0].format == "time_series"
        assert sql_panel.targets[0].datasource == {
            "uid": "postgres-ds",
            "type": "postgres",
        }
        assert sql_panel.targets[1].rawSql == "SELECT COUNT(*) FROM orders"
        # format=0 is a valid, falsy value and must survive as 0, not coerced to None.
        assert sql_panel.targets[1].format == 0
        assert sql_panel.targets[1].format is not None

        # Panel 1: Prometheus panel with a string datasource and an expr target.
        prom_panel = dashboard.panels[1]
        assert prom_panel.datasource == "prometheus-ds"
        assert prom_panel.targets[0].expr == "rate(http_requests_total[5m])"
        assert prom_panel.targets[0].rawSql is None
        assert prom_panel.targets[0].format is None
        assert prom_panel.targets[0].datasource == "prometheus-ds"

        # Meta fields carried through deserialization.
        meta = parsed_response.meta
        assert meta.canAdmin is False
        assert meta.canDelete is False
        assert meta.createdBy == "admin@example.com"
        assert meta.updatedBy == "user@example.com"
        assert meta.folderId == 5
        assert meta.folderUid == "test-folder"
        assert meta.folderTitle == "Test Folder"
        assert meta.url == "/d/complete-test-uid/complete-test-dashboard"

    def test_chart_source_state_populated(self):
        """Verify register_record_chart populates chart_source_state after yield_dashboard_chart."""
        self.grafana.chart_source_state = set()
        list(self.grafana.yield_dashboard_chart(MOCK_DASHBOARD_RESPONSE))
        assert len(self.grafana.chart_source_state) == 3
        for fqn in self.grafana.chart_source_state:
            assert "mock_grafana" in fqn
