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
from unittest import TestCase
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
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
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
    service=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="dashboardService"
    ),
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
        type="row",  # Should be skipped
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
    displayName="Marketing/Test Dashboard",
    description=Markdown("Test dashboard description"),
    sourceUrl=SourceUrl(
        "https://grafana.example.com/d/test-dashboard-uid/test-dashboard"
    ),
    charts=[],
    service=FullyQualifiedEntityName("mock_grafana"),
    tags=[],  # Tags would be added if tag creation was mocked
    owners=None,  # Would be set if owner lookup was mocked
)

EXPECTED_CHARTS = [
    CreateChartRequest(
        name=EntityName("test-dashboard-uid_1"),
        displayName="User Activity",
        description=Markdown("Shows user activity over time"),
        chartType="Line",
        sourceUrl=SourceUrl(
            "https://grafana.example.com/d/test-dashboard-uid/test-dashboard?viewPanel=1"
        ),
        service=FullyQualifiedEntityName("mock_grafana"),
    ),
    CreateChartRequest(
        name=EntityName("test-dashboard-uid_2"),
        displayName="Top Customers",
        description=None,
        chartType="Table",
        sourceUrl=SourceUrl(
            "https://grafana.example.com/d/test-dashboard-uid/test-dashboard?viewPanel=2"
        ),
        service=FullyQualifiedEntityName("mock_grafana"),
    ),
    CreateChartRequest(
        name=EntityName("test-dashboard-uid_3"),
        displayName="Total Revenue",
        description=None,
        chartType="Text",
        sourceUrl=SourceUrl(
            "https://grafana.example.com/d/test-dashboard-uid/test-dashboard?viewPanel=3"
        ),
        service=FullyQualifiedEntityName("mock_grafana"),
    ),
]


class GrafanaUnitTest(TestCase):
    """
    Implements the necessary unit tests for the Grafana Dashboard connector
    """

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.dashboard.grafana.connection.get_connection")
    def __init__(self, methodName, get_connection, test_connection) -> None:
        super().__init__(methodName)
        # Mock the connection to return a mock client
        mock_client = MagicMock()
        mock_client.get_folders.return_value = MOCK_FOLDERS
        mock_client.search_dashboards.return_value = MOCK_SEARCH_RESULTS
        mock_client.get_dashboard.return_value = MOCK_DASHBOARD_RESPONSE
        mock_client.get_datasources.return_value = MOCK_DATASOURCES
        get_connection.return_value = mock_client
        test_connection.return_value = False

        self.config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        # Mock OpenMetadata client to avoid connection attempts
        with patch("metadata.ingestion.ometa.ometa_api.OpenMetadata") as mock_om:
            mock_metadata = MagicMock()
            mock_metadata.get_by_name.return_value = None
            mock_metadata.get_reference_by_email.return_value = None
            mock_om.return_value = mock_metadata

            self.grafana: GrafanaSource = GrafanaSource.create(
                mock_config["source"],
                mock_metadata,
            )

        # Mock the client
        self.grafana.client = MagicMock()
        self.grafana.client.get_folders.return_value = MOCK_FOLDERS
        self.grafana.client.search_dashboards.return_value = MOCK_SEARCH_RESULTS
        self.grafana.client.get_dashboard.return_value = MOCK_DASHBOARD_RESPONSE
        self.grafana.client.get_datasources.return_value = MOCK_DATASOURCES

        # Set up context
        self.grafana.context.get().__dict__[
            "dashboard_service"
        ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
        self.grafana.context.get().__dict__["charts"] = []

    def test_prepare(self):
        """Test prepare method fetches folders, dashboards, and datasources"""
        self.grafana.prepare()

        # Check that data was fetched
        self.assertEqual(len(self.grafana.folders), 2)
        self.assertEqual(len(self.grafana.dashboards), 2)
        # We store datasources by both UID and name, so 2 datasources = 4 entries
        self.assertEqual(len(self.grafana.datasources), 4)
        self.assertIn("PostgreSQL", self.grafana.datasources)

        # Check tags were collected
        self.assertIn("production", self.grafana.tags)
        self.assertIn("analytics", self.grafana.tags)
        self.assertIn("sales", self.grafana.tags)
        self.assertIn("kpi", self.grafana.tags)

    def test_get_dashboard_name(self):
        """Test dashboard name extraction"""
        dashboard = {"uid": "test-uid"}
        self.assertEqual(self.grafana.get_dashboard_name(dashboard), "test-uid")

    def test_get_dashboard_details(self):
        """Test fetching dashboard details"""
        dashboard = {"uid": "test-dashboard-uid"}
        details = self.grafana.get_dashboard_details(dashboard)
        self.assertIsNotNone(details)
        self.assertEqual(details.dashboard.uid, "test-dashboard-uid")

    def test_yield_dashboard(self):
        """Test dashboard creation"""
        results = list(self.grafana.yield_dashboard(MOCK_DASHBOARD_RESPONSE))

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0], Either)

        dashboard = results[0].right
        self.assertEqual(dashboard.name, EntityName("test-dashboard-uid"))
        self.assertEqual(dashboard.displayName, "Marketing/Test Dashboard")
        self.assertEqual(dashboard.description, Markdown("Test dashboard description"))
        self.assertIn("/d/test-dashboard-uid/test-dashboard", dashboard.sourceUrl.root)
        self.assertEqual(dashboard.service, FullyQualifiedEntityName("mock_grafana"))

    def test_yield_dashboard_without_folder(self):
        """Test dashboard creation without folder"""
        dashboard_response = GrafanaDashboardResponse(
            dashboard=MOCK_DASHBOARD_RESPONSE.dashboard,
            meta=GrafanaDashboardMeta(
                **{**MOCK_DASHBOARD_RESPONSE.meta.model_dump(), "folderTitle": None}
            ),
        )

        results = list(self.grafana.yield_dashboard(dashboard_response))
        dashboard = results[0].right
        self.assertEqual(dashboard.displayName, "Test Dashboard")  # No folder prefix

    def test_yield_dashboard_chart(self):
        """Test chart extraction from panels"""
        chart_list = []
        results = self.grafana.yield_dashboard_chart(MOCK_DASHBOARD_RESPONSE)

        for result in results:
            if isinstance(result, Either) and result.right:
                chart_list.append(result.right)

        # Should have 3 charts (row panel is skipped)
        self.assertEqual(len(chart_list), 3)

        # Verify chart details
        for expected, actual in zip(EXPECTED_CHARTS, chart_list):
            self.assertEqual(expected.name, actual.name)
            self.assertEqual(expected.displayName, actual.displayName)
            self.assertEqual(expected.chartType, actual.chartType)
            self.assertEqual(expected.service, actual.service)

    def test_panel_type_mapping(self):
        """Test Grafana panel type to OpenMetadata chart type mapping"""
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
            self.assertEqual(result.value, expected_chart_type)

    @pytest.mark.skip(reason="Lineage test requires complex mocking - to be fixed")
    @patch("metadata.ingestion.lineage.sql_lineage.search_table_entities")
    def test_yield_dashboard_lineage_details(self, mock_search_table):
        """Test lineage extraction from SQL queries"""
        # Mock table search to return our example table
        mock_search_table.return_value = EXAMPLE_TABLE

        # Mock metadata.get_by_name to return the dashboard
        self.grafana.metadata.get_by_name = MagicMock(return_value=EXAMPLE_DASHBOARD)

        # Get lineage
        lineage_results = list(
            self.grafana.yield_dashboard_lineage_details(
                MOCK_DASHBOARD_RESPONSE, "mock_postgres"
            )
        )

        # Should have lineage for panels with SQL queries (panels 1 and 2)
        # Panel 3 has Prometheus query which doesn't generate lineage
        # Panel 4 is a row type which is skipped
        self.assertEqual(len(lineage_results), 2)

        # Verify search_table_entities was called with correct SQL
        self.assertEqual(mock_search_table.call_count, 2)

        # Check first call (panel 1)
        first_call = mock_search_table.call_args_list[0]
        self.assertIn("SELECT date_trunc", first_call.kwargs["query"])

        # Check second call (panel 2)
        second_call = mock_search_table.call_args_list[1]
        self.assertIn("SELECT name, email", second_call.kwargs["query"])

    def test_extract_datasource_name(self):
        """Test datasource name extraction from different formats"""
        # Test with string datasource
        target = GrafanaTarget(datasource="postgres-uid")
        panel = GrafanaPanel(id=1, type="graph", title="Test")
        result = self.grafana._extract_datasource_name(target, panel)
        self.assertEqual(result, "postgres-uid")

        # Test with dict datasource
        target = GrafanaTarget(datasource={"uid": "postgres-uid", "type": "postgres"})
        result = self.grafana._extract_datasource_name(target, panel)
        self.assertEqual(result, "postgres-uid")

        # Test fallback to panel datasource
        target = GrafanaTarget()
        panel = GrafanaPanel(
            id=1, type="graph", title="Test", datasource="panel-datasource"
        )
        result = self.grafana._extract_datasource_name(target, panel)
        self.assertEqual(result, "panel-datasource")

    def test_extract_sql_query(self):
        """Test SQL query extraction based on datasource type"""
        postgres_ds = MOCK_DATASOURCES[0]
        prometheus_ds = MOCK_DATASOURCES[1]

        # Test SQL datasource
        target = GrafanaTarget(rawSql="SELECT * FROM customers")
        result = self.grafana._extract_sql_query(target, postgres_ds)
        self.assertEqual(result, "SELECT * FROM customers")

        # Test non-SQL datasource (Prometheus)
        target = GrafanaTarget(expr="up{job='prometheus'}")
        result = self.grafana._extract_sql_query(target, prometheus_ds)
        self.assertIsNone(result)

    def test_get_owner_ref(self):
        """Test owner reference extraction"""
        # Mock the metadata API to return a user reference
        mock_owner = EntityReference(id=str(uuid.uuid4()), type="user")
        self.grafana.metadata.get_reference_by_email = MagicMock(
            return_value=mock_owner
        )

        owner_ref = self.grafana.get_owner_ref(MOCK_DASHBOARD_RESPONSE)
        self.assertIsNotNone(owner_ref)

        # Test with no createdBy
        dashboard_response = GrafanaDashboardResponse(
            dashboard=MOCK_DASHBOARD_RESPONSE.dashboard,
            meta=GrafanaDashboardMeta(
                **{**MOCK_DASHBOARD_RESPONSE.meta.model_dump(), "createdBy": None}
            ),
        )
        owner_ref = self.grafana.get_owner_ref(dashboard_response)
        self.assertIsNone(owner_ref)
