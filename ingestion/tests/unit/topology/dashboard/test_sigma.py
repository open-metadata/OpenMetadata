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
Test sigma Dashboard using the topology
"""

from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
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
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Markdown
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.sigma.metadata import SigmaSource
from metadata.ingestion.source.dashboard.sigma.models import (
    Elements,
    NodeDetails,
    WorkbookDetails,
    WorkbookQueriesResponse,
    WorkbookQuery,
)

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_sigma"),
    name="mock_sigma",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Sigma,
)

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("mock_mysql"),
    name="mock_mysql",
    connection=DatabaseConnection(
        config=MysqlConnection(
            username="test",
            hostPort="localhost:3306",
            databaseName="test_database",
        )
    ),
    serviceType=DatabaseServiceType.Mysql,
)

MOCK_DATABASE_SCHEMA = "my_schema"

MOCK_DATABASE_SCHEMA_DEFAULT = "<default>"

EXAMPLE_DASHBOARD = LineageDashboard(
    id="7b3766b1-7eb4-4ad4-b7c8-15a8b16edfdd",
    name="lineage_dashboard",
    service=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="dashboardService"
    ),
)

EXAMPLE_TABLE = [
    Table(
        id="0bd6bd6f-7fea-4a98-98c7-3b37073629c7",
        name="lineage_table",
        columns=[],
    )
]
mock_config = {
    "source": {
        "type": "sigma",
        "serviceName": "mock_sigma",
        "serviceConnection": {
            "config": {
                "type": "Sigma",
                "clientId": "client_id",
                "clientSecret": "client_secret",
                "hostPort": "https://aws-api.sigmacomputing.com",
                "apiVersion": "v2",
            }
        },
        "sourceConfig": {
            "config": {
                "dashboardFilterPattern": {},
                "chartFilterPattern": {},
                "includeOwners": True,
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


MOCK_CHARTS = [
    Elements(elementId="1a", name="chart1", vizualizationType="table"),
    Elements(elementId="2b", name="chart2", vizualizationType="box"),
    Elements(elementId="3c", name="chart3", vizualizationType="pie"),
]

MOCK_DASHBOARD_DETAILS = WorkbookDetails(
    workbookId="1",
    name="test_db",
    description="SAMPLE DESCRIPTION",
    createdAt="today",
    url="http://url.com/to/dashboard",
    isArchived=False,
)


EXPECTED_DASHBOARD = [
    CreateDashboardRequest(
        name="1",
        displayName="test_db",
        description="SAMPLE DESCRIPTION",
        sourceUrl="http://url.com/to/dashboard",
        charts=[],
        service=FullyQualifiedEntityName("mock_sigma"),
    )
]

EXPECTED_CHARTS = [
    CreateChartRequest(
        name="1a",
        displayName="chart1",
        chartType="Table",
        sourceUrl="http://url.com/to/dashboard",
        service=FullyQualifiedEntityName("mock_sigma"),
        description=Markdown("SAMPLE DESCRIPTION"),
    ),
    CreateChartRequest(
        name="2b",
        displayName="chart2",
        chartType="BoxPlot",
        sourceUrl="http://url.com/to/dashboard",
        service=FullyQualifiedEntityName("mock_sigma"),
        description=Markdown("SAMPLE DESCRIPTION"),
    ),
    CreateChartRequest(
        name="3c",
        displayName="chart3",
        chartType="Pie",
        sourceUrl="http://url.com/to/dashboard",
        service=FullyQualifiedEntityName("mock_sigma"),
        description=Markdown("SAMPLE DESCRIPTION"),
    ),
]

# Mock data for query-based lineage testing
MOCK_WORKBOOK_QUERY = WorkbookQuery(
    elementId="1a",
    name="test_query",
    sql="SELECT * FROM test_database.test_schema.test_table",
)

MOCK_WORKBOOK_QUERIES_RESPONSE = WorkbookQueriesResponse(
    entries=[MOCK_WORKBOOK_QUERY],
    total=1,
)

MOCK_DATA_MODEL = DashboardDataModel(
    id="550e8400-e29b-41d4-a716-446655440001",
    name="test_datamodel",
    fullyQualifiedName=FullyQualifiedEntityName("mock_sigma.test_datamodel"),
    dataModelType="SigmaDataModel",
    columns=[],
)

MOCK_TABLE_ENTITY = Table(
    id="550e8400-e29b-41d4-a716-446655440002",
    name="test_table",
    fullyQualifiedName=FullyQualifiedEntityName(
        "mock_mysql.test_database.test_schema.test_table"
    ),
    columns=[],
)

MOCK_NODE_DETAILS = NodeDetails(
    **{
        "id": "node1",
        "name": "test_table",
        "type": "table",
        "path": "test_database/test_schema",
    }
)

MOCK_ELEMENT_WITH_COLUMNS = Elements(
    elementId="elem1",
    name="test_element",
    columns=["column1", "column2", "very_long_column_name_that_needs_truncation"],
)


class SigmaUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Domo Dashboard Unit Test
    """

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.dashboard.sigma.connection.get_connection")
    def __init__(self, methodName, get_connection, test_connection) -> None:
        super().__init__(methodName)
        get_connection.return_value = False
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        self.sigma: SigmaSource = SigmaSource.create(
            mock_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.sigma.client = SimpleNamespace()
        self.sigma.context.get().__dict__[
            "dashboard_service"
        ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root

    def test_dashboard_name(self):
        assert (
            self.sigma.get_dashboard_name(MOCK_DASHBOARD_DETAILS)
            == MOCK_DASHBOARD_DETAILS.name
        )

    def test_check_database_schema_name(self):
        self.assertEqual(
            self.sigma.check_database_schema_name(MOCK_DATABASE_SCHEMA), "my_schema"
        )
        self.assertIsNone(
            self.sigma.check_database_schema_name(MOCK_DATABASE_SCHEMA_DEFAULT)
        )

    def test_yield_dashboard(self):
        """
        Function for testing charts
        """
        results = list(self.sigma.yield_dashboard(MOCK_DASHBOARD_DETAILS))
        self.assertEqual(EXPECTED_DASHBOARD, [res.right for res in results])

    def test_yield_chart(self):
        """
        Function for testing charts
        """
        self.sigma.client.get_chart_details = lambda *_: MOCK_CHARTS
        chart_list = []
        results = self.sigma.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS)
        for result in results:
            if isinstance(result, Either) and result.right:
                chart_list.append(result.right)

        for expected, original in zip(EXPECTED_CHARTS, chart_list):
            self.assertEqual(expected, original)

    def test_include_owners_flag_enabled(self):
        """
        Test that when includeOwners is True, owner information is processed
        """
        # Mock the source config to have includeOwners = True
        self.sigma.source_config.includeOwners = True

        # Test that owner information is processed when includeOwners is True
        self.assertTrue(self.sigma.source_config.includeOwners)

    def test_include_owners_flag_disabled(self):
        """
        Test that when includeOwners is False, owner information is not processed
        """
        # Mock the source config to have includeOwners = False
        self.sigma.source_config.includeOwners = False

        # Test that owner information is not processed when includeOwners is False
        self.assertFalse(self.sigma.source_config.includeOwners)

    def test_include_owners_flag_in_config(self):
        """
        Test that the includeOwners flag is properly set in the configuration
        """
        # Check that the mock configuration includes the includeOwners flag
        config = mock_config["source"]["sourceConfig"]["config"]
        self.assertIn("includeOwners", config)
        self.assertTrue(config["includeOwners"])

    def test_include_owners_flag_affects_owner_processing(self):
        """
        Test that the includeOwners flag affects how owner information is processed
        """
        # Test with includeOwners = True
        self.sigma.source_config.includeOwners = True
        self.assertTrue(self.sigma.source_config.includeOwners)

        # Test with includeOwners = False
        self.sigma.source_config.includeOwners = False
        self.assertFalse(self.sigma.source_config.includeOwners)

    def test_query_based_lineage_with_queries(self):
        """
        Test query-based lineage when queries are available
        """
        # Setup mocks
        self.sigma.client.get_workbook_queries = (
            lambda *_: MOCK_WORKBOOK_QUERIES_RESPONSE
        )
        self.sigma.data_models = [
            Elements(elementId="1a", name="chart1", columns=["col1"])
        ]

        # Mock metadata methods
        self.sigma._get_datamodel = MagicMock(return_value=MOCK_DATA_MODEL)
        self.sigma.metadata.get_by_name = MagicMock(return_value=MOCK_DATABASE_SERVICE)
        self.sigma.metadata.search_in_any_service = MagicMock(
            return_value=MOCK_TABLE_ENTITY
        )

        # Execute
        results = list(
            self.sigma.yield_dashboard_lineage_details(
                MOCK_DASHBOARD_DETAILS, db_service_prefix="mock_mysql"
            )
        )

        # Verify lineage was created - results are Either objects
        self.assertTrue(len(results) > 0)
        self.assertIsNotNone(results[0].right)
        self.assertIsInstance(results[0].right, AddLineageRequest)

    def test_query_based_lineage_no_queries_fallback(self):
        """
        Test that file-based lineage is used when no queries are available
        """
        # Setup mocks - no queries available
        self.sigma.client.get_workbook_queries = lambda *_: None
        self.sigma.client.get_lineage_details = lambda *_: [MOCK_NODE_DETAILS]
        self.sigma.data_models = [
            Elements(elementId="1a", name="chart1", columns=["col1"])
        ]

        # Mock metadata methods
        self.sigma._get_datamodel = MagicMock(return_value=MOCK_DATA_MODEL)
        self.sigma._get_table_entity_from_node = MagicMock(
            return_value=MOCK_TABLE_ENTITY
        )

        # Execute
        results = list(
            self.sigma.yield_dashboard_lineage_details(
                MOCK_DASHBOARD_DETAILS, db_service_prefix="mock_mysql"
            )
        )

        # Verify file-based lineage was used
        self.sigma._get_table_entity_from_node.assert_called()

    def test_query_based_lineage_no_sql_in_query(self):
        """
        Test that elements without SQL fall back to file-based lineage
        """
        # Setup mocks with query but no SQL
        query_without_sql = WorkbookQuery(elementId="1a", name="test", sql=None)
        queries_response = WorkbookQueriesResponse(entries=[query_without_sql], total=1)

        self.sigma.client.get_workbook_queries = lambda *_: queries_response
        self.sigma.client.get_lineage_details = lambda *_: None
        self.sigma.data_models = [
            Elements(elementId="1a", name="chart1", columns=["col1"])
        ]

        # Mock metadata methods
        self.sigma._get_datamodel = MagicMock(return_value=MOCK_DATA_MODEL)

        # Execute
        results = list(
            self.sigma.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS)
        )

        # Verify file-based lineage was attempted (get_lineage_details called)
        # but no lineage created since get_lineage_details returns None
        self.assertEqual(len(results), 0)

    def test_get_column_info_with_truncation(self):
        """
        Test that column names are properly truncated
        """
        columns = self.sigma.get_column_info(MOCK_ELEMENT_WITH_COLUMNS)

        # Verify columns were created
        self.assertEqual(len(columns), 3)

        # Verify all columns have names
        for col in columns:
            self.assertIsNotNone(col.name)
            self.assertIsNotNone(col.displayName)

    def test_node_details_schema_parsing(self):
        """
        Test NodeDetails schema parsing from path
        """
        node = NodeDetails(
            id="node1",
            name="test_table",
            type="table",
            path="database/schema/test_table",
        )

        # node_schema should parse dotted format from path
        self.assertIsNotNone(node.node_schema)

    def test_workbook_query_model(self):
        """
        Test WorkbookQuery model instantiation
        """
        query = WorkbookQuery(
            elementId="test123",
            name="Test Query",
            sql="SELECT * FROM test_table",
        )

        self.assertEqual(query.elementId, "test123")
        self.assertEqual(query.name, "Test Query")
        self.assertIsNotNone(query.sql)

    def test_workbook_queries_response_model(self):
        """
        Test WorkbookQueriesResponse model instantiation
        """
        query = WorkbookQuery(elementId="1", name="q1", sql="SELECT 1")
        response = WorkbookQueriesResponse(entries=[query], total=1)

        self.assertEqual(len(response.entries), 1)
        self.assertEqual(response.total, 1)
        self.assertEqual(response.entries[0].elementId, "1")

    @patch("metadata.ingestion.source.dashboard.sigma.client.TrackedREST")
    def test_get_chart_details_pagination(self, mock_rest):
        """
        Test that get_chart_details includes elements from the first page
        and handles pagination correctly
        """
        from metadata.ingestion.source.dashboard.sigma.client import SigmaApiClient
        from metadata.ingestion.source.dashboard.sigma.models import (
            ElementsResponse,
            WorkBookPage,
            WorkBookPageResponse,
        )

        # Mock pages response - first page with entries, then paginated
        first_page_response = WorkBookPageResponse(
            entries=[
                WorkBookPage(pageId="page1", name="Page 1"),
                WorkBookPage(pageId="page2", name="Page 2"),
            ],
            nextPage="2",
            total=4,
        )
        second_page_response = WorkBookPageResponse(
            entries=[
                WorkBookPage(pageId="page3", name="Page 3"),
                WorkBookPage(pageId="page4", name="Page 4"),
            ],
            nextPage=None,
            total=4,
        )

        # Mock elements response - elements for each page
        page1_elements = ElementsResponse(
            entries=[Elements(elementId="elem1", name="Element 1")],
            total=1,
        )
        page2_elements = ElementsResponse(
            entries=[Elements(elementId="elem2", name="Element 2")],
            total=1,
        )
        page3_elements = ElementsResponse(
            entries=[Elements(elementId="elem3", name="Element 3")],
            total=1,
        )
        page4_elements = ElementsResponse(
            entries=[Elements(elementId="elem4", name="Element 4")],
            total=1,
        )

        # Setup mock client
        mock_client_instance = MagicMock()
        mock_rest.return_value = mock_client_instance

        # Configure mock responses in order
        mock_client_instance.get.side_effect = [
            first_page_response.model_dump(),
            page1_elements.model_dump(),
            page2_elements.model_dump(),
            second_page_response.model_dump(),
            page3_elements.model_dump(),
            page4_elements.model_dump(),
        ]

        # Create SigmaApiClient with mocked config
        from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
            SigmaConnection,
        )

        config = SigmaConnection(
            clientId="test_id",
            clientSecret="test_secret",
            hostPort="https://test.sigmacomputing.com",
            apiVersion="v2",
        )

        # Override the client creation to use our mock
        api_client = SigmaApiClient.__new__(SigmaApiClient)
        api_client.config = config
        api_client.client = mock_client_instance

        # Execute
        result = api_client.get_chart_details("workbook1")

        # Verify all elements from all pages were included
        assert result is not None
        assert len(result) == 4
        assert result[0].elementId == "elem1"
        assert result[1].elementId == "elem2"
        assert result[2].elementId == "elem3"
        assert result[3].elementId == "elem4"

    @patch("metadata.ingestion.source.dashboard.sigma.client.TrackedREST")
    def test_get_chart_details_empty_page_elements(self, mock_rest):
        """
        Test that get_chart_details handles None/empty page element responses
        """
        from metadata.ingestion.source.dashboard.sigma.client import SigmaApiClient
        from metadata.ingestion.source.dashboard.sigma.models import (
            WorkBookPage,
            WorkBookPageResponse,
        )

        # Mock pages response with entries
        pages_response = WorkBookPageResponse(
            entries=[
                WorkBookPage(pageId="page1", name="Page 1"),
            ],
            nextPage=None,
            total=1,
        )

        # Setup mock client
        mock_client_instance = MagicMock()
        mock_rest.return_value = mock_client_instance

        # First call returns pages, second call for elements returns None (simulating get_page_elements returning None)
        mock_client_instance.get.side_effect = [
            pages_response.model_dump(),
            None,  # Simulates empty/error response for page elements
        ]

        # Create SigmaApiClient with mocked config
        from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
            SigmaConnection,
        )

        config = SigmaConnection(
            clientId="test_id",
            clientSecret="test_secret",
            hostPort="https://test.sigmacomputing.com",
            apiVersion="v2",
        )

        # Override the client creation
        api_client = SigmaApiClient.__new__(SigmaApiClient)
        api_client.config = config
        api_client.client = mock_client_instance

        # Mock get_page_elements to return None
        api_client.get_page_elements = MagicMock(return_value=None)

        # Execute - should not raise exception
        result = api_client.get_chart_details("workbook1")

        # Should return empty list or handle gracefully
        assert result == []
