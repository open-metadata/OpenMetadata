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

import json
from collections import Counter
from fnmatch import fnmatch
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.parse import urlparse
from uuid import NAMESPACE_URL, uuid5

import pytest
import requests

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.table import Column, DataType, Table
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
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    LineageInformation,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import EntityExtension, FullyQualifiedEntityName
from metadata.generated.schema.type.customProperty import PropertyType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.generated.schema.type.lifeCycle import AccessDetails, LifeCycle
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.patch_request import (
    ALLOWED_COMMON_PATCH_FIELDS,
    RESTRICT_UPDATE_LIST,
    build_patch,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.sigma.client import SigmaApiClient
from metadata.ingestion.source.dashboard.sigma.metadata import SigmaSource
from metadata.ingestion.source.dashboard.sigma.models import (
    Elements,
    ElementsResponse,
    NodeDetails,
    Workbook,
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
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="dashboardService"),
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
    createdAt="2026-01-01T00:00:00Z",
    url="http://url.com/to/dashboard",
    isArchived=False,
    elements=MOCK_CHARTS,
)


EXPECTED_DASHBOARD = [
    CreateDashboardRequest(
        name="1",
        displayName="test_db",
        description="SAMPLE DESCRIPTION",
        sourceUrl="http://url.com/to/dashboard",
        charts=[],
        dataModels=[],
        service=FullyQualifiedEntityName("mock_sigma"),
        lifeCycle=LifeCycle(created=AccessDetails(timestamp=1767225600000)),
    )
]

EXPECTED_CHARTS = [
    CreateChartRequest(
        name="1a",
        displayName="chart1",
        chartType="Table",
        sourceUrl="http://url.com/to/dashboard?:nodeId=1a",
        service=FullyQualifiedEntityName("mock_sigma"),
    ),
    CreateChartRequest(
        name="2b",
        displayName="chart2",
        chartType="BoxPlot",
        sourceUrl="http://url.com/to/dashboard?:nodeId=2b",
        service=FullyQualifiedEntityName("mock_sigma"),
    ),
    CreateChartRequest(
        name="3c",
        displayName="chart3",
        chartType="Pie",
        sourceUrl="http://url.com/to/dashboard?:nodeId=3c",
        service=FullyQualifiedEntityName("mock_sigma"),
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
    fullyQualifiedName=FullyQualifiedEntityName("mock_mysql.test_database.test_schema.test_table"),
    columns=[],
)

MOCK_NODE_DETAILS = NodeDetails(
    **{  # noqa: PIE804
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

    @patch("metadata.ingestion.source.dashboard.dashboard_service.run_test_connection")
    @patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection")
    def setUp(self, create_connection, run_test_connection) -> None:
        create_connection.return_value.client = False
        run_test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        self.sigma: SigmaSource = SigmaSource.create(
            mock_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.sigma.client = SimpleNamespace()
        self.sigma.context.get().__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root

    def test_dashboard_name(self):
        assert self.sigma.get_dashboard_name(MOCK_DASHBOARD_DETAILS) == MOCK_DASHBOARD_DETAILS.name

    def test_check_database_schema_name(self):
        self.assertEqual(self.sigma.check_database_schema_name(MOCK_DATABASE_SCHEMA), "my_schema")
        self.assertIsNone(self.sigma.check_database_schema_name(MOCK_DATABASE_SCHEMA_DEFAULT))

    def test_yield_dashboard(self):
        """
        Function for testing charts
        """
        results = list(self.sigma.yield_dashboard(MOCK_DASHBOARD_DETAILS))
        self.assertEqual(EXPECTED_DASHBOARD, [res.right for res in results])

    def test_yield_dashboard_with_datamodels(self):
        original_flag = self.sigma.source_config.includeDataModels
        self.sigma.source_config.includeDataModels = True
        original_data_models = self.sigma.context.get().dataModels
        self.sigma.context.get().__dict__["dataModels"] = ["elem1", "elem2"]

        try:
            results = list(self.sigma.yield_dashboard(MOCK_DASHBOARD_DETAILS))
            dashboard_request = results[0].right

            assert dashboard_request.dataModels is not None
            assert len(dashboard_request.dataModels) == 2
            assert dashboard_request.dataModels[0].root == "mock_sigma.model.elem1"
            assert dashboard_request.dataModels[1].root == "mock_sigma.model.elem2"
        finally:
            self.sigma.source_config.includeDataModels = original_flag
            self.sigma.context.get().__dict__["dataModels"] = original_data_models

    def test_yield_dashboard_datamodels_disabled(self):
        original_flag = self.sigma.source_config.includeDataModels
        self.sigma.source_config.includeDataModels = False

        try:
            results = list(self.sigma.yield_dashboard(MOCK_DASHBOARD_DETAILS))
            dashboard_request = results[0].right

            assert dashboard_request.dataModels is None
        finally:
            self.sigma.source_config.includeDataModels = original_flag

    def test_yield_chart(self):
        """
        Function for testing charts
        """
        chart_list = []
        results = self.sigma.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS)
        for result in results:
            if isinstance(result, Either) and result.right:
                chart_list.append(result.right)  # noqa: PERF401

        for expected, original in zip(EXPECTED_CHARTS, chart_list):  # noqa: B905
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
        self.sigma.client.get_workbook_queries = lambda *_: MOCK_WORKBOOK_QUERIES_RESPONSE
        self.sigma.client.get_workbook_lineage = lambda *_: []
        self.sigma.data_models = [Elements(elementId="1a", name="chart1", columns=["col1"], vizualizationType="table")]

        # Mock metadata methods
        self.sigma.source_config.lineageInformation = LineageInformation(dbServicePrefixes=["mock_mysql"])
        self.sigma._get_datamodel = MagicMock(return_value=MOCK_DATA_MODEL)
        self.sigma.metadata.get_by_name = MagicMock(return_value=MOCK_DATABASE_SERVICE)
        self.sigma.metadata.es_search_from_fqn = MagicMock(
            side_effect=lambda entity_type, **_: [
                MOCK_DATABASE_SERVICE if entity_type is DatabaseService else MOCK_TABLE_ENTITY
            ]
        )

        # Execute
        results = list(
            self.sigma.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, db_service_prefix="mock_mysql")
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
        self.sigma.client.get_lineage_details = lambda *_: ([MOCK_NODE_DETAILS], True)
        self.sigma.data_models = [Elements(elementId="1a", name="chart1", columns=["col1"], vizualizationType="table")]

        # Mock metadata methods
        self.sigma._get_datamodel = MagicMock(return_value=MOCK_DATA_MODEL)
        self.sigma._get_table_entity_from_node = MagicMock(return_value=MOCK_TABLE_ENTITY)

        # Execute
        results = list(  # noqa: F841
            self.sigma.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, db_service_prefix="mock_mysql")
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
        self.sigma.data_models = [Elements(elementId="1a", name="chart1", columns=["col1"], vizualizationType="table")]

        # Mock metadata methods
        self.sigma._get_datamodel = MagicMock(return_value=MOCK_DATA_MODEL)

        # Execute
        results = list(self.sigma.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS))

        # Verify file-based lineage was attempted (get_lineage_details called)
        # but no lineage created since get_lineage_details returns None
        self.assertEqual(len(results), 0)

    def test_nonviz_elements_skipped_in_lineage(self):
        """
        Test that non-visualization elements (text boxes, dividers, controls)
        are skipped in both the query-based and file-based lineage paths to
        avoid Sigma API 500 errors on elements with no upstream data.
        """
        # A non-viz element has no vizualizationType
        non_viz_element = Elements(elementId="nv1", name="text_box", columns=[])

        # Test 1: query-based path
        self.sigma.client.get_workbook_queries = lambda *_: MOCK_WORKBOOK_QUERIES_RESPONSE
        self.sigma.data_models = [non_viz_element]
        self.sigma._get_datamodel = MagicMock()

        results = list(self.sigma.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS))
        # No lineage should be yielded and _get_datamodel should never be called
        self.assertEqual(results, [])
        self.sigma._get_datamodel.assert_not_called()

        # Test 2: file-based fallback path
        self.sigma.client.get_workbook_queries = lambda *_: None
        self.sigma.data_models = [non_viz_element]
        self.sigma._get_datamodel = MagicMock()

        results = list(self.sigma.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS))
        self.assertEqual(results, [])
        self.sigma._get_datamodel.assert_not_called()

    def test_yield_datamodel_skips_nonviz_elements(self):
        """
        Verify that yield_datamodel skips non-visualization elements (no vizualizationType)
        so that DataModel entries are not created for text boxes, buttons, etc.
        """
        self.sigma.source_config.includeDataModels = True

        viz_element = Elements(elementId="viz1", name="chart1", vizualizationType="table")
        non_viz_element = Elements(elementId="nv1", name="text_box", columns=[])

        dashboard_details = MOCK_DASHBOARD_DETAILS.model_copy(update={"elements": [viz_element, non_viz_element]})

        results = [r.right for r in self.sigma.yield_datamodel(dashboard_details) if r.right]
        # Only the visualization element should produce a DataModel request
        self.assertEqual(len(results), 1)
        self.assertEqual(str(results[0].name.root), "viz1")

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

    def test_chart_source_state_populated(self):
        """Verify register_record_chart populates chart_source_state after yield_dashboard_chart."""
        self.sigma.chart_source_state = set()
        list(self.sigma.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS))
        assert len(self.sigma.chart_source_state) == 3
        for fqn in self.sigma.chart_source_state:
            assert "mock_sigma" in fqn

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


def sigma_workbook(workbook_id: str, owner_id: str) -> dict:
    return {
        "workbookId": workbook_id,
        "workbookUrlId": f"url-{workbook_id}",
        "name": f"Sales {workbook_id}",
        "url": f"https://app.sigmacomputing.com/acme/workbook/{workbook_id}",
        "path": "Shared/Finance",
        "latestVersion": 3,
        "ownerId": owner_id,
        "createdBy": owner_id,
        "updatedBy": owner_id,
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-02T00:00:00Z",
        "description": "Quarterly sales by region",
    }


def sigma_member(member_id: str, email: str) -> dict:
    return {
        "organizationId": "org-1",
        "memberId": member_id,
        "memberType": "admin",
        "firstName": "Ada",
        "lastName": "Lovelace",
        "email": email,
        "profileImgUrl": None,
        "createdBy": member_id,
        "updatedBy": member_id,
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-02T00:00:00Z",
        "homeFolderId": "folder-1",
        "userKind": "internal",
    }


SIGMA_WORKBOOKS = [
    sigma_workbook("wb-1", "member-1"),
    sigma_workbook("wb-2", "member-1"),
    sigma_workbook("wb-3", "member-2"),
]


def sigma_routes() -> dict:
    """Sigma responses valid against its OpenAPI spec, keyed by (method, path)"""
    routes = {
        ("POST", "/v2/auth/token"): {"access_token": "token", "token_type": "bearer", "expires_in": 3600},
        ("GET", "/v2/workbooks"): {"entries": SIGMA_WORKBOOKS, "nextPage": None},
        ("GET", "/v2/connections"): {"entries": [], "nextPage": None},
        ("GET", "/v2/members/member-1"): sigma_member("member-1", "ada@example.com"),
        ("GET", "/v2/members/member-2"): sigma_member("member-2", "grace@example.com"),
        ("GET", "/v2/files/T1"): {
            "id": "T1",
            "urlId": "t1-url",
            "name": "ORDERS",
            "type": "table",
            "parentId": "P1",
            "parentUrlId": "p1-url",
            "permission": "view",
            "path": "Connection Root/ANALYTICS.PUBLIC",
            "badge": None,
            "isArchived": False,
            "createdBy": "member-1",
            "updatedBy": "member-1",
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-02T00:00:00Z",
        },
    }
    for workbook in SIGMA_WORKBOOKS:
        workbook_path = f"/v2/workbooks/{workbook['workbookId']}"
        element_id = f"el-{workbook['workbookId']}"
        routes["GET", workbook_path] = workbook
        routes["GET", f"{workbook_path}/pages"] = {"entries": [{"pageId": "page-1"}], "nextPage": None}
        routes["GET", f"{workbook_path}/lineage"] = {"entries": [], "nextPage": None}
        routes["GET", f"{workbook_path}/columns"] = {"entries": [], "nextPage": None}
        routes["GET", f"{workbook_path}/pages/page-1/elements"] = {
            "entries": [{"elementId": element_id, "name": "Revenue", "vizualizationType": "bar"}],
            "nextPage": None,
        }
        routes["GET", f"{workbook_path}/lineage/elements/{element_id}"] = {
            "dependencies": {},
            "edges": [{"source": "inode-T1", "target": f"sheet-{element_id}", "type": "source"}],
        }
        # A workbook's /files entry has the workbook id; Sigma returns the badge only there
        routes["GET", f"/v2/files/{workbook['workbookId']}"] = {
            **routes["GET", "/v2/files/T1"],
            "id": workbook["workbookId"],
            "urlId": workbook["workbookUrlId"],
            "name": workbook["name"],
            "type": "workbook",
            "path": workbook["path"],
        }
    return routes


@pytest.fixture
def routes() -> dict:
    return sigma_routes()


@pytest.fixture
def sigma_over_http(routes):
    """
    SigmaSource with its real client; HTTP is answered from `routes` and counted per (method, path).
    A `page` query parameter is part of the route key, and an int route answers with that error status.
    """
    calls = Counter()

    def request(method, url, params=None, **_):
        path = urlparse(str(url)).path
        calls[method, path] += 1
        page = (params or {}).get("page")
        body = routes[(method, path, page) if page else (method, path)]
        response = requests.Response()
        response.status_code = body if isinstance(body, int) else 200
        response._content = b"" if isinstance(body, int) else json.dumps(body).encode()
        return response

    with (
        patch("metadata.ingestion.source.dashboard.dashboard_service.run_test_connection"),
        patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        source = SigmaSource.create(mock_config["source"], OpenMetadata(config.workflowConfig.openMetadataServerConfig))
    source.client = SigmaApiClient(source.service_connection)
    source.client.client._session.request = request
    # OpenMetadata's user lookup is the other boundary: no user matches unless a test says so
    source.metadata.get_reference_by_email = lambda email: None
    source.client.token_client._session.request = request
    source.context.get().__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
    return source, calls


def badge_tags(source) -> tuple[list[tuple[str, str]], list[str] | None]:
    """The tag definitions and the dashboard tags the run sends for wb-1"""
    source.source_config.includeOwners = False
    # The tag registry only checks that OpenMetadata knows the tag
    source.metadata.get_by_name = lambda entity, **_: object() if entity is Tag else None
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))
    definitions = [
        (either.right.classification_request.name.root, either.right.tag_request.name.root)
        for either in source.yield_tags(details) or []
    ]
    dashboard = next(source.yield_dashboard(details)).right
    return definitions, [label.tagFQN.root for label in dashboard.tags] if dashboard.tags else None


def test_workbook_badge_becomes_a_sigma_badge_tag(sigma_over_http, routes):
    source, _ = sigma_over_http
    routes["GET", "/v2/files/wb-1"] = {**routes["GET", "/v2/files/wb-1"], "badge": "Endorsed"}

    assert badge_tags(source) == ([("SigmaBadge", "Endorsed")], ["SigmaBadge.Endorsed"])


@pytest.mark.parametrize("files_answer", [None, 500], ids=["no badge", "failed read"])
def test_workbook_without_a_readable_badge_is_ingested_without_tags(sigma_over_http, routes, files_answer):
    source, _ = sigma_over_http
    if files_answer:
        routes["GET", "/v2/files/wb-1"] = files_answer

    assert badge_tags(source) == ([], None)


def test_badge_is_not_read_when_tags_are_off(sigma_over_http):
    source, calls = sigma_over_http
    source.source_config.includeTags = False

    source.get_dashboard_details(Workbook(workbookId="wb-1"))

    assert calls["GET", "/v2/files/wb-1"] == 0


def ingested_projects(source) -> dict[str, str | None]:
    """The project of each dashboard the run sends, with workbooks read and filtered as the topology does"""
    source.source_config.includeOwners = False
    return {
        dashboard.name.root: dashboard.project
        for details in source.get_dashboard()
        for dashboard in [next(source.yield_dashboard(details)).right]
    }


def test_dashboard_project_is_the_workbook_workspace(sigma_over_http, routes):
    source, _ = sigma_over_http
    routes["GET", "/v2/workbooks/wb-3"] = {**SIGMA_WORKBOOKS[2], "path": "My Documents"}

    assert ingested_projects(source) == {"wb-1": "Shared", "wb-2": "Shared", "wb-3": "My Documents"}


@pytest.mark.parametrize(
    "pattern, kept",
    [
        (FilterPattern(includes=["^Shared$"]), {"wb-1": "Shared", "wb-2": "Shared"}),
        (FilterPattern(excludes=["^Shared$"]), {"wb-3": "My Documents"}),
    ],
    ids=["include", "exclude"],
)
def test_project_filter_pattern_keeps_or_drops_by_workspace(sigma_over_http, routes, pattern, kept):
    source, _ = sigma_over_http
    routes["GET", "/v2/workbooks/wb-3"] = {**SIGMA_WORKBOOKS[2], "path": "My Documents"}
    source.source_config.projectFilterPattern = pattern

    assert ingested_projects(source) == kept


def test_workbook_listing_is_requested_once(sigma_over_http):
    source, calls = sigma_over_http

    assert [workbook.workbookId for workbook in source.client.get_dashboards()] == ["wb-1", "wb-2", "wb-3"]
    assert calls["GET", "/v2/workbooks"] == 1
    source.client.test_get_dashboards()
    assert calls["GET", "/v2/workbooks"] == 2


def test_each_workbook_reads_its_elements_once(sigma_over_http):
    source, calls = sigma_over_http
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))

    charts = [either.right.name.root for either in source.yield_dashboard_chart(details)]
    data_models = [either.right.name.root for either in source.yield_datamodel(details)]

    assert charts == data_models == ["el-wb-1"]
    assert calls["GET", "/v2/workbooks/wb-1/pages"] == 1
    assert calls["GET", "/v2/workbooks/wb-1/pages/page-1/elements"] == 1


def owner_emails_for(source, workbook_ids: list[str]) -> list[str]:
    emails = []
    source.metadata.get_reference_by_email = emails.append
    for workbook_id in workbook_ids:
        source.get_owner_ref(source.client.get_dashboard_detail(workbook_id))
    return emails


def test_owner_is_read_once_for_workbooks_sharing_it(sigma_over_http):
    source, calls = sigma_over_http

    assert owner_emails_for(source, ["wb-1", "wb-2"]) == ["ada@example.com", "ada@example.com"]
    assert calls["GET", "/v2/members/member-1"] == 1


def test_each_distinct_owner_is_read(sigma_over_http):
    source, calls = sigma_over_http

    assert owner_emails_for(source, ["wb-1", "wb-3"]) == ["ada@example.com", "grace@example.com"]
    assert calls["GET", "/v2/members/member-1"] == 1
    assert calls["GET", "/v2/members/member-2"] == 1


def test_table_file_is_read_once_for_elements_sharing_it(sigma_over_http):
    source, calls = sigma_over_http

    tables = [
        [node.name for node in source.client.get_lineage_details(workbook_id, f"el-{workbook_id}")[0]]
        for workbook_id in ("wb-1", "wb-2")
    ]

    assert tables == [["ORDERS"], ["ORDERS"]]
    assert calls["GET", "/v2/files/T1"] == 1


def warehouse_table(service: str, table: str, database: str = "ANALYTICS") -> Table:
    name = f"{service}.{database}.PUBLIC.{table}"
    return Table(id=str(uuid5(NAMESPACE_URL, name)), name=table, fullyQualifiedName=name, columns=[])


def warehouse_service(name: str, service_type: DatabaseServiceType) -> DatabaseService:
    return DatabaseService(id=str(uuid5(NAMESPACE_URL, name)), name=name, serviceType=service_type)


def lineage_sources(
    source,
    routes,
    prefixes: list[str],
    catalog: list[Table],
    sql: str | None,
    service_type: DatabaseServiceType = DatabaseServiceType.Snowflake,
    searches: list[str] | None = None,
) -> list[str]:
    """
    FQNs of the tables wb-1's element is linked to, over every dbServicePrefixes entry as the base class
    runs it. OpenMetadata's search answers from `catalog` with its wildcard matching; `sql` None takes
    the fallback path (no queries, element lineage then /files). Table searches are recorded in `searches`.
    """
    services = {table.fullyQualifiedName.root.split(".")[0] for table in catalog}

    def es_search_from_fqn(entity_type, fqn_search_string, **_):
        if entity_type is DatabaseService:
            return [warehouse_service(fqn_search_string, service_type)] if fqn_search_string in services else []
        if searches is not None:
            searches.append(fqn_search_string)
        return [table for table in catalog if fnmatch(table.fullyQualifiedName.root.lower(), fqn_search_string.lower())]

    def get_by_name(entity, fqn, **_):
        if entity is DatabaseService:
            return warehouse_service(fqn, service_type) if fqn in services else None
        return MOCK_DATA_MODEL if entity is DashboardDataModel else None

    source.metadata.es_search_from_fqn = es_search_from_fqn
    source.metadata.get_by_name = get_by_name
    source.source_config.lineageInformation = LineageInformation(dbServicePrefixes=prefixes)
    # Sigma can leave a query's name out
    entries = [{"elementId": "el-wb-1", "sql": sql}] if sql else []
    routes["GET", "/v2/workbooks/wb-1/queries"] = {"entries": entries, "nextPage": None}
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))
    list(source.yield_datamodel(details))
    return [
        either.right.edge.fromEntity.fullyQualifiedName
        for prefix in prefixes or [None]
        for either in source.yield_dashboard_lineage_details(details, prefix)
        if either.right
    ]


SIGMA_SQL = "SELECT * FROM ANALYTICS.PUBLIC.ORDERS"


def test_a_table_reference_is_searched_once_per_prefix_in_a_run(sigma_over_http, routes):
    source, _ = sigma_over_http
    prefixes = ["wh_a", "wh_b", "wh_c"]
    searches: list[str] = []

    linked = lineage_sources(
        source, routes, prefixes, [warehouse_table("wh_a", "ORDERS")], SIGMA_SQL, searches=searches
    )

    assert linked == ["wh_a.ANALYTICS.PUBLIC.ORDERS"]
    # The lineage stage runs once per prefix; the reference is resolved across all of them only once
    assert len(searches) == len(prefixes)


@pytest.mark.parametrize("sql", [SIGMA_SQL, None], ids=["sql", "fallback"])
def test_a_table_found_in_one_configured_service_is_linked(sigma_over_http, routes, sql):
    source, _ = sigma_over_http
    catalog = [warehouse_table("wh_a", "ORDERS"), warehouse_table("wh_b", "CUSTOMERS")]

    assert lineage_sources(source, routes, ["wh_a", "wh_b"], catalog, sql) == ["wh_a.ANALYTICS.PUBLIC.ORDERS"]


@pytest.mark.parametrize("sql", [SIGMA_SQL, None], ids=["sql", "fallback"])
def test_a_table_found_in_two_configured_services_is_not_linked(sigma_over_http, routes, sql):
    source, _ = sigma_over_http
    catalog = [warehouse_table("wh_a", "ORDERS"), warehouse_table("wh_b", "ORDERS")]

    assert lineage_sources(source, routes, ["wh_a", "wh_b"], catalog, sql) == []


@pytest.mark.parametrize("sql", [SIGMA_SQL, None], ids=["sql", "fallback"])
def test_no_table_is_linked_without_db_service_prefixes(sigma_over_http, routes, sql):
    source, calls = sigma_over_http

    assert lineage_sources(source, routes, [], [warehouse_table("wh_a", "ORDERS")], sql) == []
    # Nothing could be linked, so nothing is read
    assert calls["GET", "/v2/workbooks/wb-1/queries"] == 0


def test_a_table_matching_twice_in_one_service_is_not_linked(sigma_over_http, routes):
    source, _ = sigma_over_http
    catalog = [warehouse_table("wh_a", "ORDERS"), warehouse_table("wh_a", "ORDERS", database="SALES")]

    assert lineage_sources(source, routes, ["wh_a"], catalog, "SELECT * FROM PUBLIC.ORDERS") == []


def test_a_wildcard_table_the_service_cannot_resolve_is_not_linked(sigma_over_http, routes):
    source, _ = sigma_over_http
    catalog = [warehouse_table("bq_sigma", "events_20240101")]
    sql = "SELECT * FROM `ANALYTICS.PUBLIC.events_2024*`"

    assert lineage_sources(source, routes, ["bq_sigma"], catalog, sql, DatabaseServiceType.BigQuery) == []


def test_a_failed_table_search_links_nothing(sigma_over_http, routes):
    source, _ = sigma_over_http

    def search_down(*_, **__):
        raise requests.ConnectionError("search is down")

    # A fresh run whose search is down: a reference resolved earlier in the same run would be reused
    source.metadata.es_search_from_fqn = search_down
    source.metadata.get_by_name = lambda entity, fqn, **_: MOCK_DATA_MODEL if entity is DashboardDataModel else None
    source.source_config.lineageInformation = LineageInformation(dbServicePrefixes=["wh_a"])
    routes["GET", "/v2/workbooks/wb-1/queries"] = {"entries": [], "nextPage": None}
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))
    list(source.yield_datamodel(details))

    assert list(source.yield_dashboard_lineage_details(details, "wh_a")) == []


@pytest.mark.parametrize("sql", [SIGMA_SQL, None], ids=["sql", "fallback"])
def test_a_table_outside_the_prefix_database_is_not_linked(sigma_over_http, routes, sql):
    source, _ = sigma_over_http

    assert lineage_sources(source, routes, ["wh_a.SALES"], [warehouse_table("wh_a", "ORDERS")], sql) == []


def sigma_file(file_id: str, name: str, file_type: str) -> dict:
    return {
        **sigma_routes()["GET", "/v2/files/T1"],
        "id": file_id,
        "urlId": file_id,
        "name": name,
        "type": file_type,
    }


# Sigma's documented example response for the element lineage endpoint (list-lineage): the element's table
# is a `dependencies` entry, and every edge starts at a `dependencies` key.
DOCUMENTED_ELEMENT_LINEAGE = {
    "dependencies": {
        "2MLjb1f67ldr3FMNI2L6Pf": {"name": "STATIONS", "nodeId": "2MLjb1f67ldr3FMNI2L6Pf", "type": "table"},
        "4ZJD7G8AR03qf2oySPwoc3": {
            "elementId": "3fqWi0z9SWwxuilnuq8w34",
            "name": "Train Stations",
            "nodeId": "4ZJD7G8AR03qf2oySPwoc3",
            "type": "sheet",
        },
        "Ttd4meevWGks3ZYdVWt8X": {
            "elementId": "5AbJJlOiPPtgpL3cCk7GqA",
            "name": "Sum of Dock Count by City",
            "nodeId": "Ttd4meevWGks3ZYdVWt8X",
            "type": "sheet",
        },
    },
    "edges": [
        {"source": "4ZJD7G8AR03qf2oySPwoc3", "target": "Ttd4meevWGks3ZYdVWt8X", "type": "source"},
        {"source": "2MLjb1f67ldr3FMNI2L6Pf", "target": "4ZJD7G8AR03qf2oySPwoc3", "type": "source"},
    ],
}


def test_fallback_links_the_table_keyed_in_dependencies(sigma_over_http, routes):
    source, calls = sigma_over_http
    routes["GET", "/v2/workbooks/wb-1/lineage/elements/el-wb-1"] = DOCUMENTED_ELEMENT_LINEAGE
    routes["GET", "/v2/files/2MLjb1f67ldr3FMNI2L6Pf"] = sigma_file("2MLjb1f67ldr3FMNI2L6Pf", "STATIONS", "table")

    linked = lineage_sources(source, routes, ["wh_a"], [warehouse_table("wh_a", "STATIONS")], None)

    assert linked == ["wh_a.ANALYTICS.PUBLIC.STATIONS"]
    # The table is read once; the two sheets are not
    assert calls["GET", "/v2/files/2MLjb1f67ldr3FMNI2L6Pf"] == 1
    assert not [path for _, path in calls if path.endswith(("/4ZJD7G8AR03qf2oySPwoc3", "/Ttd4meevWGks3ZYdVWt8X"))]


def test_a_dataset_keyed_in_dependencies_is_read(sigma_over_http, routes):
    source, _ = sigma_over_http
    # DataHub's mocked element lineage for this endpoint: a Sigma dataset keyed as `inode-<urlId>`
    routes["GET", "/v2/workbooks/wb-1/lineage/elements/el-wb-1"] = {
        "dependencies": {
            "qrL7BEq8LR": {
                "nodeId": "qrL7BEq8LR",
                "type": "sheet",
                "name": "Count of Profile Id by Status",
                "elementId": "el-wb-1",
            },
            "inode-49HFLTr6xytgrPly3PFsNC": {
                "nodeId": "inode-49HFLTr6xytgrPly3PFsNC",
                "type": "dataset",
                "name": "PETS",
            },
        },
        "edges": [{"source": "inode-49HFLTr6xytgrPly3PFsNC", "target": "qrL7BEq8LR", "type": "source"}],
    }
    routes["GET", "/v2/files/49HFLTr6xytgrPly3PFsNC"] = sigma_file("49HFLTr6xytgrPly3PFsNC", "PETS", "dataset")

    assert [node.name for node in source.client.get_lineage_details("wb-1", "el-wb-1")[0]] == ["PETS"]


# ORDERS is in two databases of wh_a: a display path that drops the database finds no single table
TWO_ORDERS = [warehouse_table("wh_a", "ORDERS"), warehouse_table("wh_a", "ORDERS", database="SALES")]
SALES_ORDERS = ["wh_a.SALES.PUBLIC.ORDERS"]
# Read as schema ORDERS: finds no table
TABLE_IN_PATH = "Connection Root/SALES/PUBLIC/ORDERS"


@pytest.mark.parametrize(
    "files_path, connection_path, catalog, prefixes, linked, path_reads",
    [
        ("Connection Root/SALES.PUBLIC", 500, TWO_ORDERS, ["wh_a"], SALES_ORDERS, 0),
        ("Connection Root/ANALYTICS/PUBLIC", ["SALES", "PUBLIC", "ORDERS"], TWO_ORDERS, ["wh_a"], SALES_ORDERS, 1),
        (
            "Connection Root/ANALYTICS/PUBLIC",
            ["SALES", "PUBLIC", "ORDERS"],
            TWO_ORDERS,
            ["wh_a", "wh_b"],
            SALES_ORDERS,
            1,
        ),
        (TABLE_IN_PATH, ["SALES", "PUBLIC", "ORDERS"], TWO_ORDERS, ["wh_a.SALES"], SALES_ORDERS, 1),
        (TABLE_IN_PATH, ["SALES", "PUBLIC", "ORDERS"], TWO_ORDERS, ["wh_a.ANALYTICS"], [], 1),
        (
            "Connection Root/MY.DB/PUBLIC",
            ["MY.DB", "PUBLIC", "ORDERS"],
            [warehouse_table("wh_a", "ORDERS", database='"MY.DB"')],
            ["wh_a"],
            ['wh_a."MY.DB".PUBLIC.ORDERS'],
            1,
        ),
        (
            "Connection Root/SALES DATA/PUBLIC/ORDERS",
            ["SALES DATA", "PUBLIC", "ORDERS"],
            [warehouse_table("wh_a", "ORDERS", database="SALES DATA")],
            ["wh_a"],
            ["wh_a.SALES DATA.PUBLIC.ORDERS"],
            1,
        ),
        ("Connection Root/ANALYTICS/STAGING", ["PUBLIC", "ORDERS"], TWO_ORDERS[:1], ["wh_a"], [], 1),
        (
            "Connection Root/ANALYTICS/PUBLIC",
            ["SALES", "PUBLIC", "CUSTOMERS"],
            [*TWO_ORDERS, warehouse_table("wh_a", "CUSTOMERS", database="SALES")],
            ["wh_a"],
            [],
            1,
        ),
        ("Connection Root/ANALYTICS/PUBLIC", 500, TWO_ORDERS, ["wh_a"], [], 1),
    ],
    ids=[
        "display-path-finds-it",
        "connection-path-names-the-database",
        "read-once-across-prefixes",
        "inside-the-prefix-database",
        "outside-the-prefix-database",
        "dot-in-database-name",
        "space-in-database-name",
        "two-parts-not-read-as-schema-and-table",
        "other-table-in-the-path",
        "failed-read",
    ],
)
def test_the_connection_path_is_read_only_when_the_display_path_finds_no_table(
    sigma_over_http, routes, files_path, connection_path, catalog, prefixes, linked, path_reads
):
    source, calls = sigma_over_http
    routes["GET", "/v2/files/T1"]["path"] = files_path
    routes["GET", "/v2/connections/paths/T1"] = (
        {"connectionId": "conn-1", "path": connection_path} if isinstance(connection_path, list) else connection_path
    )

    assert lineage_sources(source, routes, prefixes, catalog, None) == linked
    assert calls["GET", "/v2/connections/paths/T1"] == path_reads


def test_the_connection_path_of_a_dataset_is_not_read(sigma_over_http, routes):
    source, calls = sigma_over_http
    routes["GET", "/v2/files/T1"].update(type="dataset", path="Connection Root/ANALYTICS/PUBLIC")
    routes["GET", "/v2/connections/paths/T1"] = {"connectionId": "conn-1", "path": ["SALES", "PUBLIC", "ORDERS"]}

    assert lineage_sources(source, routes, ["wh_a"], TWO_ORDERS, None) == []
    assert calls["GET", "/v2/connections/paths/T1"] == 0


def sigma_connection(connection_id: str, connection_type: str) -> dict:
    return {
        "organizationId": "org-1",
        "connectionId": connection_id,
        "isSample": False,
        "isAuditLog": False,
        "lastActiveAt": "2026-01-02T00:00:00Z",
        "name": f"Warehouse {connection_id}",
        "type": connection_type,
        "useOauth": False,
        "createdBy": "member-1",
        "updatedBy": "member-1",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-02T00:00:00Z",
    }


def test_each_connection_type_is_read_once(sigma_over_http, routes):
    source, calls = sigma_over_http
    routes["GET", "/v2/connections/conn-sf"] = sigma_connection("conn-sf", "snowflake")
    routes["GET", "/v2/connections/conn-bq"] = sigma_connection("conn-bq", "bigQuery")

    types = [source.client.get_connection_type(connection) for connection in ("conn-sf", "conn-bq", "conn-sf")]

    assert types == ["snowflake", "bigQuery", "snowflake"]
    assert (calls["GET", "/v2/connections/conn-sf"], calls["GET", "/v2/connections/conn-bq"]) == (1, 1)


def test_a_failed_connection_read_leaves_its_type_unknown_without_rereading(sigma_over_http, routes):
    source, calls = sigma_over_http
    routes["GET", "/v2/connections/conn-sf"] = 500

    assert [source.client.get_connection_type("conn-sf") for _ in range(2)] == [None, None]
    assert calls["GET", "/v2/connections/conn-sf"] == 1


# Parses to the table only in BigQuery's dialect; Snowflake's (the test prefix service's) finds none
BIGQUERY_ONLY_SQL = "SELECT * EXCEPT (AMOUNT) FROM `ANALYTICS.PUBLIC.ORDERS`"


def workbook_on_connections(routes, connection_types: dict[str, str]) -> None:
    routes["GET", "/v2/workbooks/wb-1/lineage"] = {
        "entries": [
            {"type": "table", "connectionId": connection, "name": "ORDERS", "inodeId": f"inode-{connection}"}
            for connection in connection_types
        ],
        "nextPage": None,
    }
    for connection, kind in connection_types.items():
        routes["GET", f"/v2/connections/{connection}"] = sigma_connection(connection, kind)


def test_sql_is_parsed_in_the_dialect_of_the_workbook_connection(sigma_over_http, routes):
    source, _ = sigma_over_http
    workbook_on_connections(routes, {"conn-bq": "bigQuery"})

    linked = lineage_sources(source, routes, ["wh_a"], [warehouse_table("wh_a", "ORDERS")], BIGQUERY_ONLY_SQL)

    assert linked == ["wh_a.ANALYTICS.PUBLIC.ORDERS"]


def test_a_workbook_on_several_connections_keeps_the_prefix_service_dialect(sigma_over_http, routes):
    source, _ = sigma_over_http
    workbook_on_connections(routes, {"conn-bq": "bigQuery", "conn-sf": "snowflake"})

    assert lineage_sources(source, routes, ["wh_a"], [warehouse_table("wh_a", "ORDERS")], BIGQUERY_ONLY_SQL) == []


def test_a_partly_read_workbook_lineage_keeps_the_prefix_service_dialect(sigma_over_http, routes):
    source, _ = sigma_over_http
    workbook_on_connections(routes, {"conn-bq": "bigQuery"})
    routes["GET", "/v2/workbooks/wb-1/lineage"] = {**routes["GET", "/v2/workbooks/wb-1/lineage"], "nextPage": "2"}
    routes["GET", "/v2/workbooks/wb-1/lineage", "2"] = 500

    assert lineage_sources(source, routes, ["wh_a"], [warehouse_table("wh_a", "ORDERS")], BIGQUERY_ONLY_SQL) == []


def sigma_data_model(data_model_id: str, name: str) -> dict:
    return {
        "dataModelId": data_model_id,
        "dataModelUrlId": f"url-{data_model_id}",
        "name": name,
        "url": f"https://app.sigmacomputing.com/acme/data-model/url-{data_model_id}",
        "path": "Shared/Models",
        "latestVersion": 4,
        "ownerId": "member-1",
        "createdBy": "member-1",
        "updatedBy": "member-1",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-02T00:00:00Z",
    }


@pytest.fixture
def sigma_data_models(routes):
    routes["GET", "/v2/dataModels"] = {"entries": [sigma_data_model("dm-1", "Sales Model")], "nextPage": None}
    routes["GET", "/v2/dataModels/dm-1/elements"] = {
        "entries": [
            {"elementId": "dmEl1", "name": "Orders", "type": "table", "columns": ["Order Id", "Amount"]},
            {"elementId": "dmEl2", "name": "Customers", "type": "table", "columns": ["Customer Id"]},
        ],
        "nextPage": None,
    }
    routes["GET", "/v2/dataModels/dm-1/lineage"] = {"entries": [], "nextPage": None}
    routes["GET", "/v2/dataModels/dm-1/columns"] = {"entries": [], "nextPage": None}
    return routes


def bulk_stage(source) -> list:
    """Every record the bulk data model stage sends, in order"""
    return [either.right for model in source.list_datamodels() for either in source.yield_bulk_datamodel(model)]


def bulk_data_models(source) -> list:
    return [record for record in bulk_stage(source) if isinstance(record, CreateDashboardDataModelRequest)]


def test_a_sigma_data_model_is_one_data_model_with_a_table_column_per_element(sigma_over_http, sigma_data_models):
    source, _ = sigma_over_http

    [data_model] = bulk_data_models(source)

    assert (data_model.name.root, data_model.displayName, data_model.dataModelType.value) == (
        "dm-1",
        "Sales Model",
        "SigmaDataModel",
    )
    assert data_model.sourceUrl.root == "https://app.sigmacomputing.com/acme/data-model/url-dm-1"
    assert [
        (column.name.root, column.displayName, column.dataType.value, [child.displayName for child in column.children])
        for column in data_model.columns
    ] == [
        ("dmEl1", "Orders", "TABLE", ["Order Id", "Amount"]),
        ("dmEl2", "Customers", "TABLE", ["Customer Id"]),
    ]


def test_sigma_data_models_are_not_read_when_data_models_are_off(sigma_over_http, sigma_data_models):
    source, calls = sigma_over_http
    source.source_config.includeDataModels = False

    assert bulk_data_models(source) == []
    assert calls["GET", "/v2/dataModels"] == 0


def test_a_failed_element_read_keeps_the_existing_data_model(sigma_over_http, sigma_data_models):
    source, _ = sigma_over_http
    sigma_data_models["GET", "/v2/dataModels/dm-1/elements"] = 500
    source.datamodel_source_state = set()

    assert bulk_data_models(source) == []
    assert source.datamodel_source_state == {"mock_sigma.model.dm-1"}


def test_data_model_filter_pattern_applies_to_sigma_data_models(sigma_over_http, sigma_data_models):
    source, calls = sigma_over_http
    source.source_config.dataModelFilterPattern = FilterPattern(excludes=["^Sales Model$"])

    assert bulk_data_models(source) == []
    assert calls["GET", "/v2/dataModels/dm-1/elements"] == 0


def test_a_sigma_data_model_is_owned_by_its_owner(sigma_over_http, sigma_data_models):
    source, _ = sigma_over_http
    # The data model's ownerId is member-1, whose email is ada@example.com
    source.metadata.get_reference_by_email = lambda email: EntityReferenceList(
        root=[EntityReference(id=str(uuid5(NAMESPACE_URL, email)), type="user", name=email)]
    )

    [data_model] = bulk_data_models(source)

    assert [owner.name for owner in data_model.owners.root] == ["ada@example.com"]


def table_row(inode_id: str, name: str) -> dict:
    return {"type": "table", "connectionId": "conn-1", "name": name, "inodeId": inode_id}


def element_row(element_id: str, source_ids: list[str], data_source_ids: list[str] | None = None) -> dict:
    """An element row; its root sources default to its direct ones"""
    return {
        "type": "element",
        "elementId": element_id,
        "sourceIds": source_ids,
        "dataSourceIds": source_ids if data_source_ids is None else data_source_ids,
    }


def data_model_row(data_model_id: str, name: str) -> dict:
    return {"type": "data-model", "connectionId": None, "name": name, "dataModelId": data_model_id}


@pytest.fixture
def two_sigma_data_models(sigma_data_models):
    """dm-1 (Sales Model) and dm-2 (Orders Model, url id url-dm-2); neither has lineage rows yet"""
    routes = sigma_data_models
    routes["GET", "/v2/dataModels"]["entries"].append(sigma_data_model("dm-2", "Orders Model"))
    routes["GET", "/v2/dataModels/dm-2/elements"] = {
        "entries": [{"elementId": "dm2El1", "name": "Orders", "type": "table", "columns": ["Order Id"]}],
        "nextPage": None,
    }
    routes["GET", "/v2/dataModels/dm-2/lineage"] = {"entries": [], "nextPage": None}
    return routes


def serve_openmetadata(source, catalog: list[Table], prefixes: list[str]) -> None:
    """OpenMetadata knows every data model, and answers table searches from `catalog` with its wildcard matching"""
    services = {table.fullyQualifiedName.root.split(".")[0] for table in catalog}

    def es_search_from_fqn(entity_type, fqn_search_string, **_):
        if entity_type is DatabaseService:
            return (
                [warehouse_service(fqn_search_string, DatabaseServiceType.Snowflake)]
                if fqn_search_string in services
                else []
            )
        return [table for table in catalog if fnmatch(table.fullyQualifiedName.root.lower(), fqn_search_string.lower())]

    def get_by_name(entity, fqn, **_):
        if entity is DatabaseService:
            return warehouse_service(fqn, DatabaseServiceType.Snowflake) if fqn in services else None
        if entity is DashboardDataModel:
            return DashboardDataModel(
                id=str(uuid5(NAMESPACE_URL, fqn)),
                name=fqn.rsplit(".", 1)[-1],
                fullyQualifiedName=fqn,
                dataModelType="SigmaDataModel",
                columns=[],
            )
        return None

    source.metadata.es_search_from_fqn = es_search_from_fqn
    source.metadata.get_by_name = get_by_name
    source.source_config.lineageInformation = LineageInformation(dbServicePrefixes=prefixes)


def data_model_lineage(source, prefixes: list[str] | None = None, catalog: list[Table] | None = None):
    """(from FQN, to FQN) of every lineage edge the bulk data model stage sends"""
    serve_openmetadata(
        source, catalog or [warehouse_table("wh_a", "ORDERS")], ["wh_a"] if prefixes is None else prefixes
    )
    return [
        (
            record.lineage_request.edge.fromEntity.fullyQualifiedName,
            record.lineage_request.edge.toEntity.fullyQualifiedName,
        )
        for record in bulk_stage(source)
        if hasattr(record, "lineage_request")
    ]


ORDERS_TO_SALES_MODEL = ("wh_a.ANALYTICS.PUBLIC.ORDERS", "mock_sigma.model.dm-1")


# T1's /files entry has id T1 and url id t1-url: an element can name it by either, with or without `inode-`
@pytest.mark.parametrize("source_id", ["inode-t1-url", "t1-url", "inode-T1", "T1"])
def test_a_table_an_element_reads_is_linked_to_its_sigma_data_model(sigma_over_http, sigma_data_models, source_id):
    source, _ = sigma_over_http
    sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        table_row("T1", "ORDERS"),
        element_row("dmEl1", [source_id]),
    ]

    assert data_model_lineage(source) == [ORDERS_TO_SALES_MODEL]


def test_a_table_read_by_several_elements_is_linked_once(sigma_over_http, sigma_data_models):
    source, _ = sigma_over_http
    sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        table_row("T1", "ORDERS"),
        element_row("dmEl1", ["inode-t1-url"]),
        table_row("T1", "ORDERS"),
        element_row("dmEl2", ["inode-t1-url"]),
    ]

    assert data_model_lineage(source) == [ORDERS_TO_SALES_MODEL]


def test_a_table_no_element_reads_is_not_linked(sigma_over_http, sigma_data_models):
    source, calls = sigma_over_http
    sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        table_row("T1", "ORDERS"),
        element_row("dmEl1", ["inode-other-url"]),
    ]

    assert data_model_lineage(source) == []
    assert calls["GET", "/v2/files/T1"] == 1


def test_a_sigma_data_model_another_one_reads_is_linked_to_it(sigma_over_http, two_sigma_data_models):
    source, _ = sigma_over_http
    # The element names dm-2's element in the <id>/<suffix> form of Sigma's workbook lineage example; the table
    # feeds dm-2, not dm-1
    two_sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        data_model_row("dm-2", "Orders Model"),
        table_row("T1", "ORDERS"),
        element_row("dmEl1", ["url-dm-2/dm2El1"]),
    ]

    assert data_model_lineage(source) == [("mock_sigma.model.dm-2", "mock_sigma.model.dm-1")]


def test_a_sigma_data_model_named_by_its_id_is_linked(sigma_over_http, two_sigma_data_models):
    source, _ = sigma_over_http
    two_sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        data_model_row("dm-2", "Orders Model"),
        element_row("dmEl1", ["dm-2"]),
    ]

    assert data_model_lineage(source) == [("mock_sigma.model.dm-2", "mock_sigma.model.dm-1")]


@pytest.mark.parametrize(
    "source_ids, data_source_ids",
    [([], ["dm-2", "inode-t1-url"]), (["dm-2", "inode-t1-url"], [])],
    ids=["root-sources-only", "direct-sources-only"],
)
def test_a_source_named_in_either_list_of_an_element_is_linked(
    sigma_over_http, two_sigma_data_models, source_ids, data_source_ids
):
    source, _ = sigma_over_http
    two_sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        data_model_row("dm-2", "Orders Model"),
        table_row("T1", "ORDERS"),
        element_row("dmEl1", source_ids, data_source_ids),
    ]

    assert sorted(data_model_lineage(source)) == [
        ("mock_sigma.model.dm-2", "mock_sigma.model.dm-1"),
        ORDERS_TO_SALES_MODEL,
    ]


def test_a_sigma_data_model_no_element_reads_is_not_linked(sigma_over_http, two_sigma_data_models):
    source, _ = sigma_over_http
    two_sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        data_model_row("dm-2", "Orders Model"),
        element_row("dmEl1", ["inode-t1-url"]),
    ]

    assert data_model_lineage(source) == []


def test_every_page_of_a_sigma_data_model_lineage_is_read(sigma_over_http, sigma_data_models):
    source, _ = sigma_over_http
    sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"] = {
        "entries": [element_row("dmEl1", ["inode-t1-url"])],
        "nextPage": "2",
    }
    sigma_data_models["GET", "/v2/dataModels/dm-1/lineage", "2"] = {
        "entries": [table_row("T1", "ORDERS")],
        "nextPage": None,
    }

    assert data_model_lineage(source) == [ORDERS_TO_SALES_MODEL]


def test_a_sigma_data_model_table_found_in_two_services_is_not_linked(sigma_over_http, sigma_data_models):
    source, _ = sigma_over_http
    sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        table_row("T1", "ORDERS"),
        element_row("dmEl1", ["inode-t1-url"]),
    ]
    catalog = [warehouse_table("wh_a", "ORDERS"), warehouse_table("wh_b", "ORDERS")]

    assert data_model_lineage(source, ["wh_a", "wh_b"], catalog) == []


def test_a_sigma_data_model_table_is_found_through_its_connection_path(sigma_over_http, sigma_data_models):
    source, calls = sigma_over_http
    # The display path drops the database, and ORDERS is in two
    sigma_data_models["GET", "/v2/files/T1"]["path"] = "Connection Root/ANALYTICS/PUBLIC"
    sigma_data_models["GET", "/v2/connections/paths/T1"] = {"connectionId": "c1", "path": ["SALES", "PUBLIC", "ORDERS"]}
    sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        table_row("T1", "ORDERS"),
        element_row("dmEl1", ["inode-t1-url"]),
    ]

    assert data_model_lineage(source, catalog=TWO_ORDERS) == [("wh_a.SALES.PUBLIC.ORDERS", "mock_sigma.model.dm-1")]
    assert calls["GET", "/v2/connections/paths/T1"] == 1


def test_without_db_service_prefixes_only_sigma_data_models_are_linked(sigma_over_http, two_sigma_data_models):
    source, calls = sigma_over_http
    two_sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        data_model_row("dm-2", "Orders Model"),
        table_row("T1", "ORDERS"),
        element_row("dmEl1", ["url-dm-2/dm2El1", "inode-t1-url"]),
    ]

    assert data_model_lineage(source, prefixes=[]) == [("mock_sigma.model.dm-2", "mock_sigma.model.dm-1")]
    # No table could be linked, so none is read
    assert calls["GET", "/v2/files/T1"] == 0


def test_a_failed_sigma_data_model_lineage_read_links_nothing_and_keeps_the_data_model(
    sigma_over_http, sigma_data_models
):
    source, _ = sigma_over_http
    sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"] = 500

    assert data_model_lineage(source) == []
    assert [data_model.name.root for data_model in bulk_data_models(source)] == ["dm-1"]


def test_a_filtered_sigma_data_model_lineage_is_not_read(sigma_over_http, sigma_data_models):
    source, calls = sigma_over_http
    source.source_config.dataModelFilterPattern = FilterPattern(excludes=["^Sales Model$"])

    assert data_model_lineage(source) == []
    assert calls["GET", "/v2/dataModels/dm-1/lineage"] == 0


def test_sigma_data_model_lineage_is_sent_after_every_data_model_is_written(sigma_over_http, two_sigma_data_models):
    source, _ = sigma_over_http
    two_sigma_data_models["GET", "/v2/dataModels/dm-1/lineage"]["entries"] = [
        data_model_row("dm-2", "Orders Model"),
        element_row("dmEl1", ["url-dm-2/dm2El1"]),
    ]
    serve_openmetadata(source, [], [])

    records = [type(record).__name__ for record in bulk_stage(source)]

    # dm-1 reads dm-2, which is written after it: the barrier flushes both before the edge is sent
    assert records == [
        "CreateDashboardDataModelRequest",
        "CreateDashboardDataModelRequest",
        "Barrier",
        "OMetaLineageRequest",
    ]


def sigma_column(element_id: str, name: str, formula: str) -> dict:
    return {
        "columnId": f"{element_id}-{name}",
        "name": name,
        "formula": formula,
        "type": {"type": "number"},
        "elementId": element_id,
    }


MARGIN_COLUMNS = [
    sigma_column("el-wb-1", "Cost", "[ORDERS/Cost]"),
    sigma_column("el-wb-1", "Total", "[Cost] + [MRP]"),
    sigma_column("el-wb-1", "Note", ""),
]


def workbook_column_descriptions(source, routes) -> dict[str, str | None]:
    """The description of each column of wb-1's element, as the data model stage sends it"""
    routes["GET", "/v2/workbooks/wb-1/pages/page-1/elements"]["entries"][0]["columns"] = ["Cost", "Total", "Note"]
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))
    [request] = [either.right for either in source.yield_datamodel(details)]
    return {column.displayName: column.description and column.description.root for column in request.columns}


TOTAL_FORMULA = {"Cost": None, "Total": "**Formula:** `[Cost] + [MRP]`", "Note": None}


@pytest.mark.parametrize(
    "pages, descriptions",
    [
        # Cost only names its source column, which its lineage already shows
        ([MARGIN_COLUMNS], TOTAL_FORMULA),
        ([MARGIN_COLUMNS[:1], MARGIN_COLUMNS[1:]], TOTAL_FORMULA),
        ([[*MARGIN_COLUMNS, sigma_column("elOther", "Total", "[Cost] * 2")]], TOTAL_FORMULA),
        # A name an element holds twice cannot be told apart: neither gets the formula
        ([[*MARGIN_COLUMNS, sigma_column("el-wb-1", "Total", "[Cost] * 2")]], {**TOTAL_FORMULA, "Total": None}),
        (500, {"Cost": None, "Total": None, "Note": None}),
    ],
    ids=["one-page", "two-pages", "same-name-in-another-element", "repeated-name", "failed-read"],
)
def test_a_workbook_element_column_shows_its_sigma_formula(sigma_over_http, routes, pages, descriptions):
    source, _ = sigma_over_http
    if isinstance(pages, int):
        routes["GET", "/v2/workbooks/wb-1/columns"] = pages
    else:
        for number, entries in enumerate(pages, start=1):
            page = {"entries": entries, "nextPage": str(number + 1) if number < len(pages) else None}
            routes[
                ("GET", "/v2/workbooks/wb-1/columns", str(number))
                if number > 1
                else ("GET", "/v2/workbooks/wb-1/columns")
            ] = page

    assert workbook_column_descriptions(source, routes) == descriptions


def test_column_formulas_are_not_read_when_data_models_are_off(sigma_over_http):
    source, calls = sigma_over_http
    source.source_config.includeDataModels = False

    source.get_dashboard_details(Workbook(workbookId="wb-1"))

    assert calls["GET", "/v2/workbooks/wb-1/columns"] == 0


def test_a_sigma_data_model_column_shows_its_sigma_formula(sigma_over_http, sigma_data_models):
    source, _ = sigma_over_http
    sigma_data_models["GET", "/v2/dataModels/dm-1/columns"]["entries"] = [
        sigma_column("dmEl1", "Order Id", "[ORDERS/Order Id]"),
        sigma_column("dmEl1", "Amount", "Round([ORDERS/Amount], 2)"),
        sigma_column("dmEl2", "Customer Id", ""),
    ]

    [data_model] = bulk_data_models(source)

    assert {
        (column.displayName, child.displayName): child.description and child.description.root
        for column in data_model.columns
        for child in column.children
    } == {
        ("Orders", "Order Id"): None,
        ("Orders", "Amount"): "**Formula:** `Round([ORDERS/Amount], 2)`",
        ("Customers", "Customer Id"): None,
    }


# Sigma's documented example response for the workbook lineage endpoint (list-lineage-tree): element
# 3fqWi0z9SWwxuilnuq8w34 lists the data model d5a56ed4-… among its root sources.
DOCUMENTED_WORKBOOK_LINEAGE = json.loads(
    """
{
  "entries": [
    {"dataSourceIds": ["QzcnTZrK9y8TjZs0T6OKO/En4r45kOFn"], "elementId": "5AbJJlOiPPtgpL3cCk7GqA",
     "sourceIds": ["QzcnTZrK9y8TjZs0T6OKO"], "type": "element"},
    {"dataSourceIds": ["QzcnTZrK9y8TjZs0T6OKO/En4r45kOFn"], "elementId": "5AbJJlOiPPtgpL3cCk7GqA",
     "sourceIds": ["4ZJD7G8AR03qf2oySPwoc3"], "type": "element"},
    {"dataSourceIds": ["QzcnTZrK9y8TjZs0T6OKO/En4r45kOFn", "d5a56ed4-16bf-4de3-be32-e0738f31be42"],
     "elementId": "3fqWi0z9SWwxuilnuq8w34", "sourceIds": ["2MLjb1f67ldr3FMNI2L6Pf", "4ZJD7G8AR03qf2oySPwoc3"],
     "type": "element"},
    {"connectionId": "dd76be0a-08bc-4c88-8a79-9956f933e701", "dataModelId": "d5a56ed4-16bf-4de3-be32-e0738f31be42",
     "name": "Docks data model", "type": "data-model"},
    {"connectionId": "dd76be0a-08bc-4c88-8a79-9956f933e701", "inodeId": "eef50bc2-16c5-44ee-a913-9ae9d95e5295",
     "name": "DOCKS", "type": "table"}
  ],
  "nextPage": null
}
"""
)


def data_model_edges(source) -> list[tuple[str, str]]:
    """The data model -> data model edges the lineage stage sends for wb-1; every data model is known to OpenMetadata"""

    def get_by_name(entity, fqn, **_):
        if entity is not DashboardDataModel:
            return None
        return DashboardDataModel(
            id=str(uuid5(NAMESPACE_URL, fqn)),
            name=fqn.rsplit(".", 1)[-1],
            fullyQualifiedName=fqn,
            dataModelType="SigmaDataModel",
            columns=[],
        )

    source.metadata.get_by_name = get_by_name
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))
    return [
        (request.edge.fromEntity.fullyQualifiedName, request.edge.toEntity.fullyQualifiedName)
        for either in source.yield_dashboard_lineage(details)
        if (request := getattr(either.right, "lineage_request", None))
        and request.edge.fromEntity.type == "dashboardDataModel"
    ]


def test_a_workbook_element_reading_a_sigma_data_model_gets_lineage_from_it(sigma_over_http, routes):
    source, _ = sigma_over_http
    routes["GET", "/v2/workbooks/wb-1/lineage"] = DOCUMENTED_WORKBOOK_LINEAGE

    assert data_model_edges(source) == [
        ("mock_sigma.model.d5a56ed4-16bf-4de3-be32-e0738f31be42", "mock_sigma.model.3fqWi0z9SWwxuilnuq8w34")
    ]


def test_no_data_model_lineage_is_read_when_data_models_are_off(sigma_over_http, routes):
    source, calls = sigma_over_http
    routes["GET", "/v2/workbooks/wb-1/lineage"] = DOCUMENTED_WORKBOOK_LINEAGE
    source.source_config.includeDataModels = False

    assert data_model_edges(source) == []
    assert calls["GET", "/v2/workbooks/wb-1/lineage"] == 0


def test_chart_links_to_its_element(sigma_over_http):
    source, _ = sigma_over_http
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))

    (chart,) = [either.right for either in source.yield_dashboard_chart(details)]

    assert chart.sourceUrl.root == "https://app.sigmacomputing.com/acme/workbook/wb-1?:nodeId=el-wb-1"


def test_chart_does_not_copy_the_workbook_description(sigma_over_http):
    source, _ = sigma_over_http
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))

    (chart,) = [either.right for either in source.yield_dashboard_chart(details)]

    assert chart.description is None


def test_dashboard_keeps_the_workbook_description_and_link(sigma_over_http):
    source, _ = sigma_over_http
    source.source_config.includeOwners = False
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))

    (dashboard,) = [either.right for either in source.yield_dashboard(details)]

    assert dashboard.description.root == "Quarterly sales by region"
    assert dashboard.sourceUrl.root == "https://app.sigmacomputing.com/acme/workbook/wb-1"


TITLED_AND_UNTITLED_ELEMENTS = {
    "entries": [
        {"elementId": "el-titled", "name": "Revenue", "vizualizationType": "bar"},
        {"elementId": "el-untitled", "vizualizationType": "line"},
    ],
    "nextPage": None,
    "total": 2,
}


def chart_names_under_filter(source, chart_filter: FilterPattern | None) -> list[str]:
    source.source_config.chartFilterPattern = chart_filter
    elements = ElementsResponse.model_validate(TITLED_AND_UNTITLED_ELEMENTS).entries
    details = source.get_dashboard_details(Workbook(workbookId="wb-1")).model_copy(update={"elements": elements})
    return [either.right.displayName for either in source.yield_dashboard_chart(details)]


@pytest.mark.parametrize(
    "chart_filter, charts",
    [
        (None, ["Revenue", "Element el-untitled"]),
        (FilterPattern(includes=["^Revenue$"]), ["Revenue"]),
        (FilterPattern(excludes=["^Cost$"]), ["Revenue", "Element el-untitled"]),
        (FilterPattern(excludes=["^Revenue$"]), ["Element el-untitled"]),
        (FilterPattern(includes=["^Element "]), ["Element el-untitled"]),
    ],
    ids=["no-filter", "include-titled", "exclude-other", "exclude-titled", "include-untitled"],
)
def test_chart_filter_matches_untitled_elements_by_display_name(sigma_over_http, chart_filter, charts):
    source, _ = sigma_over_http

    assert chart_names_under_filter(source, chart_filter) == charts


def test_filtered_untitled_element_is_reported_by_display_name(sigma_over_http):
    source, _ = sigma_over_http

    assert chart_names_under_filter(source, FilterPattern(excludes=["^Element "])) == ["Revenue"]
    assert source.status.filtered == [{"Element el-untitled": "Chart Pattern not allowed"}]


def data_models_and_lineage(source, routes, data_model_filter: FilterPattern) -> tuple[list, list, list]:
    """Charts, data models and fallback lineage for wb-1, whose element lineage runs through /lineage and /files"""
    source.source_config.dataModelFilterPattern = data_model_filter
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))

    charts = [either.right.name.root for either in source.yield_dashboard_chart(details)]
    data_models = [either.right.name.root for either in source.yield_datamodel(details)]
    lineage = lineage_sources(source, routes, ["wh_a"], [warehouse_table("wh_a", "ORDERS")], None)
    return charts, data_models, lineage


@pytest.mark.parametrize(
    "data_model_filter",
    [FilterPattern(excludes=["^Revenue$"]), FilterPattern(includes=["^Cost$"])],
    ids=["excluded", "not-included"],
)
def test_filtered_data_model_gets_no_entity_lineage_or_lineage_calls(sigma_over_http, routes, data_model_filter):
    source, calls = sigma_over_http

    charts, data_models, lineage = data_models_and_lineage(source, routes, data_model_filter)

    assert charts == ["el-wb-1"]
    assert data_models == []
    assert lineage == []
    assert calls["GET", "/v2/workbooks/wb-1/lineage/elements/el-wb-1"] == 0
    assert calls["GET", "/v2/files/T1"] == 0


def test_data_model_outside_the_filter_keeps_its_entity_and_lineage(sigma_over_http, routes):
    source, calls = sigma_over_http

    charts, data_models, lineage = data_models_and_lineage(source, routes, FilterPattern(excludes=["^Cost$"]))

    assert charts == data_models == ["el-wb-1"]
    assert lineage == ["wh_a.ANALYTICS.PUBLIC.ORDERS"]
    assert calls["GET", "/v2/workbooks/wb-1/lineage/elements/el-wb-1"] == 1
    assert calls["GET", "/v2/files/T1"] == 1


@pytest.mark.parametrize("sql", [SIGMA_SQL, None], ids=["sql", "files"])
@pytest.mark.parametrize(
    "element_fields, eligible",
    [
        ({"type": "table"}, True),
        ({"type": "visualization"}, True),
        # Sigma's element lineage endpoint accepts "a table, pivot table, or visualization"
        ({"type": "pivot-table", "vizualizationType": "pivot"}, True),
        ({"vizualizationType": "bar"}, True),
        ({"type": None, "vizualizationType": "table"}, True),
        ({"type": "control"}, False),
        ({"type": "text"}, False),
        ({"type": "control", "vizualizationType": "bar"}, False),
        ({}, False),
    ],
    ids=[
        "table",
        "visualization",
        "pivot-table",
        "legacy",
        "null-type",
        "control",
        "text",
        "control-with-viz",
        "unknown",
    ],
)
def test_data_element_types_create_charts_models_and_lineage(sigma_over_http, routes, element_fields, eligible, sql):
    source, _ = sigma_over_http
    routes["GET", "/v2/workbooks/wb-1/pages/page-1/elements"] = {
        "entries": [{"elementId": "el-wb-1", "name": "Revenue", "columns": ["Amount"], **element_fields}],
        "nextPage": None,
    }
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))

    charts = [result.right.name.root for result in source.yield_dashboard_chart(details) if result.right]
    models = [result.right.name.root for result in source.yield_datamodel(details) if result.right]
    lineage = lineage_sources(source, routes, ["wh_a"], [warehouse_table("wh_a", "ORDERS")], sql)

    assert charts == models == (["el-wb-1"] if eligible else [])
    assert lineage == (["wh_a.ANALYTICS.PUBLIC.ORDERS"] if eligible else [])


def sales_table(name: str, columns: list[str]) -> Table:
    table_fqn = f"warehouse.SALES.PUBLIC.{name}"
    return Table(
        id=uuid5(NAMESPACE_URL, table_fqn),
        name=name,
        fullyQualifiedName=FullyQualifiedEntityName(table_fqn),
        columns=[
            Column(name=column, dataType=DataType.VARCHAR, fullyQualifiedName=f"{table_fqn}.{column}")
            for column in columns
        ],
    )


CUSTOMERS = sales_table("CUSTOMERS", ["CUSTOMER_ID", "CUSTOMER_NAME"])
ORDERS = sales_table("ORDERS", ["ORDER_STATUS", "CUSTOMER_ID"])
# Sigma labels an element's columns for reading (CUSTOMER_NAME shows as "Customer Name"); "Customer Id"
# is in both source tables and "Sum of Amount" is a calculated field
AMOUNT_ELEMENT = Elements(
    elementId="amountByCustomer",
    name="Sum of Amount by Customer",
    vizualizationType="bar",
    columns=["Customer Name", "Customer Id", "Order Status", "Sum of Amount"],
)
AMOUNT_SQL = (
    "SELECT c.CUSTOMER_NAME, c.CUSTOMER_ID, o.ORDER_STATUS, SUM(o.AMOUNT) "
    "FROM SALES.PUBLIC.CUSTOMERS c JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID "
    "GROUP BY 1, 2, 3"
)
AMOUNT_MODEL_FQN = "mock_sigma.model.amountByCustomer"
EXPECTED_COLUMN_LINKS = {
    CUSTOMERS.fullyQualifiedName.root: [
        (f"{CUSTOMERS.fullyQualifiedName.root}.CUSTOMER_NAME", f"{AMOUNT_MODEL_FQN}.Customer Name")
    ],
    ORDERS.fullyQualifiedName.root: [
        (f"{ORDERS.fullyQualifiedName.root}.ORDER_STATUS", f"{AMOUNT_MODEL_FQN}.Order Status")
    ],
}


@pytest.fixture
def lineage_source():
    """SigmaSource whose OpenMetadata holds the data model (built from the element's labels) and both tables"""
    with (
        patch("metadata.ingestion.source.dashboard.dashboard_service.run_test_connection"),
        patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        source = SigmaSource.create(mock_config["source"], OpenMetadata(config.workflowConfig.openMetadataServerConfig))
    source.context.get().__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
    data_model = DashboardDataModel(
        id=uuid5(NAMESPACE_URL, AMOUNT_MODEL_FQN),
        name="amountByCustomer",
        fullyQualifiedName=AMOUNT_MODEL_FQN,
        dataModelType="SigmaDataModel",
        columns=[
            column.model_copy(
                update={"fullyQualifiedName": FullyQualifiedEntityName(f"{AMOUNT_MODEL_FQN}.{column.displayName}")}
            )
            for column in source.get_column_info(AMOUNT_ELEMENT)
        ],
    )
    source.metadata.get_by_name = lambda entity, fqn, **_: (
        data_model if entity is DashboardDataModel else MOCK_DATABASE_SERVICE
    )
    source.metadata.search_in_any_service = lambda entity_type, fqn_search_string, **_: next(
        (table for table in (CUSTOMERS, ORDERS) if fqn_search_string.lower().endswith(f".{table.name.root.lower()}")),
        None,
    )
    # Tables resolve within the dbServicePrefixes services, through es_search_from_fqn: answer it from the
    # search_in_any_service stub above, which a test can replace
    source.source_config.lineageInformation = LineageInformation(dbServicePrefixes=["mock_mysql"])
    source.metadata.es_search_from_fqn = lambda entity_type, fqn_search_string, **_: (
        [MOCK_DATABASE_SERVICE]
        if entity_type is DatabaseService
        else [table]
        if (
            table := source.metadata.search_in_any_service(entity_type=entity_type, fqn_search_string=fqn_search_string)
        )
        else []
    )
    source.data_models = [AMOUNT_ELEMENT]
    source.client = SimpleNamespace(get_workbook_lineage=lambda *_: [])
    return source


def column_links(results) -> dict[str, list[tuple[str, str]]]:
    """For each table edge sent: its (table column, data model column) pairs"""
    return {
        either.right.edge.fromEntity.fullyQualifiedName: [
            (column.fromColumns[0].root, column.toColumn.root)
            for column in either.right.edge.lineageDetails.columnsLineage or []
        ]
        for either in results
        if either.right
    }


def test_sql_lineage_uses_sql_to_disambiguate_labeled_columns(lineage_source):
    lineage_source.client.get_workbook_queries = lambda *_: WorkbookQueriesResponse(
        entries=[WorkbookQuery(elementId="amountByCustomer", name="Amount", sql=AMOUNT_SQL)], total=1
    )

    results = list(
        lineage_source.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, db_service_prefix="mock_mysql")
    )

    assert column_links(results) == {
        CUSTOMERS.fullyQualifiedName.root: [
            (f"{CUSTOMERS.fullyQualifiedName.root}.CUSTOMER_ID", f"{AMOUNT_MODEL_FQN}.Customer Id"),
            (f"{CUSTOMERS.fullyQualifiedName.root}.CUSTOMER_NAME", f"{AMOUNT_MODEL_FQN}.Customer Name"),
        ],
        ORDERS.fullyQualifiedName.root: [
            (f"{ORDERS.fullyQualifiedName.root}.ORDER_STATUS", f"{AMOUNT_MODEL_FQN}.Order Status")
        ],
    }


@pytest.mark.parametrize(
    "sql, expected",
    [
        ("SELECT 0 AS CUSTOMER_NAME FROM SALES.PUBLIC.CUSTOMERS", {"CUSTOMERS": []}),
        (
            "SELECT CUSTOMER_ID AS CUSTOMER_NAME FROM SALES.PUBLIC.CUSTOMERS",
            {"CUSTOMERS": [("CUSTOMER_ID", "Customer Name")]},
        ),
        (
            "SELECT CONCAT(CUSTOMER_NAME, CUSTOMER_ID) AS ORDER_STATUS FROM SALES.PUBLIC.CUSTOMERS",
            {"CUSTOMERS": [("CUSTOMER_ID", "Order Status"), ("CUSTOMER_NAME", "Order Status")]},
        ),
        (
            "SELECT c.CUSTOMER_ID FROM SALES.PUBLIC.CUSTOMERS c "
            "JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID",
            {"CUSTOMERS": [("CUSTOMER_ID", "Customer Id")], "ORDERS": []},
        ),
        (
            "SELECT * FROM SALES.PUBLIC.CUSTOMERS",
            {"CUSTOMERS": [("CUSTOMER_ID", "Customer Id"), ("CUSTOMER_NAME", "Customer Name")]},
        ),
        (
            "SELECT * FROM SALES.PUBLIC.CUSTOMERS c JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID",
            {"CUSTOMERS": [("CUSTOMER_NAME", "Customer Name")], "ORDERS": [("ORDER_STATUS", "Order Status")]},
        ),
        (
            "SELECT c.* FROM SALES.PUBLIC.CUSTOMERS c JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID",
            {"CUSTOMERS": [("CUSTOMER_ID", "Customer Id"), ("CUSTOMER_NAME", "Customer Name")], "ORDERS": []},
        ),
        (
            "SELECT c.*, o.ORDER_STATUS AS CUSTOMER_NAME FROM SALES.PUBLIC.CUSTOMERS c "
            "JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID",
            {"CUSTOMERS": [("CUSTOMER_ID", "Customer Id")], "ORDERS": []},
        ),
        (
            "WITH base AS (SELECT CUSTOMER_ID FROM SALES.PUBLIC.CUSTOMERS) "
            "SELECT CUSTOMER_ID AS CUSTOMER_NAME FROM base",
            {"CUSTOMERS": [("CUSTOMER_ID", "Customer Name")]},
        ),
        (
            "INSERT INTO SALES.PUBLIC.RESULT SELECT CUSTOMER_NAME FROM SALES.PUBLIC.CUSTOMERS",
            {"CUSTOMERS": []},
        ),
        (
            "SELECT CUSTOMER_NAME FROM SALES.PUBLIC.CUSTOMERS; SELECT ORDER_STATUS FROM SALES.PUBLIC.ORDERS",
            {"CUSTOMERS": [], "ORDERS": []},
        ),
        (
            "SELECT CUSTOMER_ID FROM SALES.PUBLIC.CUSTOMERS c JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID",
            {"CUSTOMERS": [], "ORDERS": []},
        ),
        (
            "SELECT CUSTOMER_NAME, ORDER_STATUS FROM SALES.PUBLIC.CUSTOMERS c "
            "JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID",
            {"CUSTOMERS": [("CUSTOMER_NAME", "Customer Name")], "ORDERS": [("ORDER_STATUS", "Order Status")]},
        ),
        # Parsed paths cannot tell this from an unqualified CUSTOMER_ID, so it is withheld too
        (
            "SELECT CONCAT(c.CUSTOMER_ID, o.CUSTOMER_ID) AS ORDER_STATUS FROM SALES.PUBLIC.CUSTOMERS c "
            "JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID",
            {"CUSTOMERS": [], "ORDERS": []},
        ),
    ],
    ids=[
        "constant",
        "alias",
        "expression",
        "join",
        "wildcard",
        "wildcard-join",
        "qualified-wildcard",
        "wildcard-alias-collision",
        "cte",
        "insert",
        "multiple-statements",
        "unqualified-join-column-in-both",
        "unqualified-join-column-in-one",
        "same-column-of-both-tables",
    ],
)
def test_sql_lineage_uses_query_column_provenance(lineage_source, sql, expected):
    lineage_source.client.get_workbook_queries = lambda *_: WorkbookQueriesResponse(
        entries=[WorkbookQuery(elementId="amountByCustomer", sql=sql)]
    )

    results = list(lineage_source.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, "mock_mysql"))
    observed = {
        result.right.edge.fromEntity.fullyQualifiedName.rsplit(".", 1)[-1]: sorted(
            (source.root.rsplit(".", 1)[-1], column.toColumn.root.rsplit(".", 1)[-1])
            for column in result.right.edge.lineageDetails.columnsLineage or []
            for source in column.fromColumns
        )
        for result in results
        if result.right
    }

    assert not [result.left for result in results if result.left]
    assert observed == expected


@pytest.mark.parametrize("projection", ["*", "c.*", "*, c.CUSTOMER_ID AS ORDER_STATUS"])
@pytest.mark.parametrize("lookup_state", ["missing", "failed", "no-columns"])
def test_unresolved_wildcard_sources_keep_table_lineage(lineage_source, projection, lookup_state):
    sql = (
        f"SELECT {projection} FROM SALES.PUBLIC.CUSTOMERS c JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID"
    )
    lineage_source.client.get_workbook_queries = lambda *_: WorkbookQueriesResponse(
        entries=[WorkbookQuery(elementId="amountByCustomer", sql=sql)]
    )

    def resolve(entity_type, fqn_search_string, **_):
        if fqn_search_string.lower().endswith(".customers"):
            return CUSTOMERS
        if lookup_state == "failed":
            raise RuntimeError("search unavailable")
        if lookup_state == "no-columns":
            return ORDERS.model_copy(update={"columns": []})
        return None

    lineage_source.metadata.search_in_any_service = resolve
    results = list(lineage_source.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, "mock_mysql"))

    expected = []
    if projection == "c.*":
        expected = [
            (f"{CUSTOMERS.fullyQualifiedName.root}.CUSTOMER_ID", f"{AMOUNT_MODEL_FQN}.Customer Id"),
            (f"{CUSTOMERS.fullyQualifiedName.root}.CUSTOMER_NAME", f"{AMOUNT_MODEL_FQN}.Customer Name"),
        ]
    expected_links = {CUSTOMERS.fullyQualifiedName.root: expected}
    if lookup_state == "no-columns":
        expected_links[ORDERS.fullyQualifiedName.root] = []
    assert column_links(results) == expected_links
    assert bool([result.left for result in results if result.left]) == (lookup_state == "failed")


@pytest.mark.parametrize(
    "queries",
    [None, WorkbookQueriesResponse(entries=[WorkbookQuery(elementId="amountByCustomer", name="Amount")], total=1)],
    ids=["no workbook queries", "element without sql"],
)
def test_fallback_lineage_links_labels_that_differ_from_the_column_in_case_and_separators(lineage_source, queries):
    lineage_source.client.get_workbook_queries = lambda *_: queries
    lineage_source.client.get_lineage_details = lambda *_: (
        [
            NodeDetails(id=table.name.root, name=table.name.root, type="table", path="Snowflake/SALES.PUBLIC")
            for table in (CUSTOMERS, ORDERS)
        ],
        True,
    )

    results = list(
        lineage_source.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, db_service_prefix="mock_mysql")
    )

    assert column_links(results) == EXPECTED_COLUMN_LINKS


def test_fallback_lineage_links_no_column_when_a_source_could_not_be_read(lineage_source):
    def sigma_get(path):
        if path.endswith("/lineage/elements/amountByCustomer"):
            return {
                "dependencies": {},
                "edges": [
                    {"source": f"inode-{node}", "target": "amountByCustomer", "type": "source"}
                    for node in ("customers", "orders")
                ],
            }
        if path == "/files/customers":
            return {"id": "customers", "name": "CUSTOMERS", "type": "table", "path": "Snowflake/SALES.PUBLIC"}
        raise RuntimeError("403 Forbidden")

    client = SigmaApiClient.__new__(SigmaApiClient)
    client.client = SimpleNamespace(get=sigma_get)
    client.get_workbook_queries = lambda *_: None
    client.get_workbook_lineage = lambda *_: []
    client._file_cache = {}
    lineage_source.client = client

    results = list(
        lineage_source.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, db_service_prefix="mock_mysql")
    )

    # "Customer Id" looks unique without ORDERS, which is exactly when linking it would guess
    assert column_links(results) == {CUSTOMERS.fullyQualifiedName.root: []}


COSTS = sales_table("COSTS", ["COST", "MRP"])
PRICES = sales_table("PRICES", ["LIST_PRICE"])
MARGIN_LABELS = ["Cost", "MRP", "Total", "Margin"]


def formula_column_links(
    lineage_source, labels: list[str], formulas: dict[str, str], tables: list[Table], all_sources_read: bool = True
) -> dict[str, dict[str, list[str]]]:
    """For each table edge of an element without SQL: each data model column it feeds, with the table columns"""
    element = Elements(elementId="amountByCustomer", name="Margins", vizualizationType="bar", columns=labels)
    data_model = DashboardDataModel(
        id=uuid5(NAMESPACE_URL, AMOUNT_MODEL_FQN),
        name="amountByCustomer",
        fullyQualifiedName=AMOUNT_MODEL_FQN,
        dataModelType="SigmaDataModel",
        columns=[
            column.model_copy(
                update={"fullyQualifiedName": FullyQualifiedEntityName(f"{AMOUNT_MODEL_FQN}.{column.displayName}")}
            )
            for column in lineage_source.get_column_info(element)
        ],
    )
    lineage_source.metadata.get_by_name = lambda entity, fqn, **_: (
        data_model if entity is DashboardDataModel else MOCK_DATABASE_SERVICE
    )
    lineage_source.metadata.search_in_any_service = lambda entity_type, fqn_search_string, **_: next(
        (table for table in tables if fqn_search_string.lower().endswith(f".{table.name.root.lower()}")), None
    )
    lineage_source.data_models = [element]
    lineage_source.client.get_workbook_queries = lambda *_: None
    lineage_source.client.get_lineage_details = lambda *_: (
        [
            NodeDetails(id=table.name.root, name=table.name.root, type="table", path="Snowflake/SALES.PUBLIC")
            for table in tables
        ],
        all_sources_read,
    )
    details = MOCK_DASHBOARD_DETAILS.model_copy(update={"formulas": {"amountByCustomer": formulas}})
    return {
        either.right.edge.fromEntity.fullyQualifiedName.rsplit(".", 1)[-1]: {
            column.toColumn.root.rsplit(".", 1)[-1]: sorted(
                source.root.rsplit(".", 1)[-1] for source in column.fromColumns
            )
            for column in either.right.edge.lineageDetails.columnsLineage or []
        }
        for either in lineage_source.yield_dashboard_lineage_details(details, db_service_prefix="mock_mysql")
        if either.right
    }


LABELED = {"Cost": ["COST"], "MRP": ["MRP"]}


@pytest.mark.parametrize(
    "formulas, computed",
    [
        ({"Total": "[Cost] + [MRP]"}, {"Total": ["COST", "MRP"]}),
        (
            {"Total": "[Cost] + [MRP]", "Margin": "[Total] - [Cost]"},
            {"Total": ["COST", "MRP"], "Margin": ["COST", "MRP"]},
        ),
        ({"Total": "[Margin] + [Cost]", "Margin": "[Total]"}, {"Total": ["COST"], "Margin": ["COST"]}),
        ({"Total": "[Cost] * [Rate-Control]"}, {"Total": ["COST"]}),
        ({"Total": 'If([Cost] > 0, "[MRP]", "none")'}, {"Total": ["COST"]}),
        # Another element or source, an escape, or nothing of the element: not traced
        ({"Total": "[COSTS/Cost] + [MRP]"}, {}),
        ({"Total": "[Co\\st] + [MRP]"}, {}),
        ({"Total": "[Rate-Control] * 2"}, {}),
        ({"Total": "[cost] + [MRP]"}, {"Total": ["MRP"]}),
    ],
    ids=[
        "same-element-columns",
        "through-another-computed-column",
        "cycle",
        "control-adds-nothing",
        "string-literal-is-not-a-reference",
        "other-element-reference",
        "escape",
        "no-column-of-the-element",
        "names-match-exactly",
    ],
)
def test_a_computed_column_without_sql_gets_the_sources_of_the_columns_it_reads(lineage_source, formulas, computed):
    assert formula_column_links(lineage_source, MARGIN_LABELS, formulas, [COSTS]) == {"COSTS": {**LABELED, **computed}}


def test_a_computed_column_read_before_the_column_it_reads_still_gets_its_sources(lineage_source):
    formulas = {"Margin": "[Total] - [Cost]", "Total": "[Cost] + [MRP]"}

    links = formula_column_links(lineage_source, ["Cost", "MRP", "Margin", "Total"], formulas, [COSTS])

    assert links == {"COSTS": {**LABELED, "Margin": ["COST", "MRP"], "Total": ["COST", "MRP"]}}


def test_a_computed_column_named_like_a_warehouse_column_takes_its_sources_from_its_formula(lineage_source):
    costs_with_total = sales_table("COSTS", ["COST", "MRP", "TOTAL"])
    formulas = {"Total": "[Cost] + [MRP]", "Margin": "[Total] - [Cost]"}

    links = formula_column_links(lineage_source, MARGIN_LABELS, formulas, [costs_with_total])

    assert links == {"COSTS": {**LABELED, "Total": ["COST", "MRP"], "Margin": ["COST", "MRP"]}}


def test_a_computed_column_reading_two_tables_is_linked_from_each(lineage_source):
    links = formula_column_links(
        lineage_source, ["Cost", "List Price", "Total"], {"Total": "[Cost] + [List Price]"}, [COSTS, PRICES]
    )

    assert links == {
        "COSTS": {"Cost": ["COST"], "Total": ["COST"]},
        "PRICES": {"List Price": ["LIST_PRICE"], "Total": ["LIST_PRICE"]},
    }


def test_a_computed_column_is_not_traced_when_a_source_could_not_be_read(lineage_source):
    assert formula_column_links(
        lineage_source, MARGIN_LABELS, {"Total": "[Cost] + [MRP]"}, [COSTS], all_sources_read=False
    ) == {"COSTS": {}}


def test_a_failed_table_lookup_keeps_the_other_tables_of_the_element(lineage_source):
    lineage_source.client.get_workbook_queries = lambda *_: WorkbookQueriesResponse(
        entries=[WorkbookQuery(elementId="amountByCustomer", name="Amount", sql=AMOUNT_SQL)], total=1
    )
    search = lineage_source.metadata.search_in_any_service

    def search_failing_for_customers(entity_type, fqn_search_string, **kwargs):
        if fqn_search_string.lower().endswith(".customers"):
            raise RuntimeError("search unavailable")
        return search(entity_type=entity_type, fqn_search_string=fqn_search_string, **kwargs)

    lineage_source.metadata.search_in_any_service = search_failing_for_customers

    results = list(
        lineage_source.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, db_service_prefix="mock_mysql")
    )

    assert column_links(results) == {
        ORDERS.fullyQualifiedName.root: [
            (f"{ORDERS.fullyQualifiedName.root}.ORDER_STATUS", f"{AMOUNT_MODEL_FQN}.Order Status")
        ]
    }
    assert ["search unavailable" in either.left.error for either in results if either.left] == [True]


def test_a_source_table_missing_from_openmetadata_keeps_proven_column_lineage(lineage_source):
    lineage_source.client.get_workbook_queries = lambda *_: WorkbookQueriesResponse(
        entries=[WorkbookQuery(elementId="amountByCustomer", name="Amount", sql=AMOUNT_SQL)], total=1
    )
    search = lineage_source.metadata.search_in_any_service
    lineage_source.metadata.search_in_any_service = lambda entity_type, fqn_search_string, **kwargs: (
        None
        if fqn_search_string.lower().endswith(".customers")
        else search(entity_type=entity_type, fqn_search_string=fqn_search_string, **kwargs)
    )

    results = list(
        lineage_source.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, db_service_prefix="mock_mysql")
    )

    assert column_links(results) == {
        ORDERS.fullyQualifiedName.root: [
            (f"{ORDERS.fullyQualifiedName.root}.ORDER_STATUS", f"{AMOUNT_MODEL_FQN}.Order Status")
        ]
    }


def test_an_unqualified_column_is_not_linked_when_a_missing_table_could_hold_it(lineage_source):
    lineage_source.client.get_workbook_queries = lambda *_: WorkbookQueriesResponse(
        entries=[
            WorkbookQuery(
                elementId="amountByCustomer",
                sql="SELECT CUSTOMER_NAME, o.ORDER_STATUS FROM SALES.PUBLIC.CUSTOMERS c "
                "JOIN SALES.PUBLIC.ORDERS o ON c.CUSTOMER_ID = o.CUSTOMER_ID",
            )
        ]
    )
    search = lineage_source.metadata.search_in_any_service
    lineage_source.metadata.search_in_any_service = lambda entity_type, fqn_search_string, **kwargs: (
        None
        if fqn_search_string.lower().endswith(".orders")
        else search(entity_type=entity_type, fqn_search_string=fqn_search_string, **kwargs)
    )

    results = list(lineage_source.yield_dashboard_lineage_details(MOCK_DASHBOARD_DETAILS, "mock_mysql"))

    assert column_links(results) == {CUSTOMERS.fullyQualifiedName.root: []}


def test_dashboard_records_when_the_workbook_was_created_and_updated(sigma_over_http, routes):
    source, _ = sigma_over_http
    # The timestamps of DataHub's mocked workbook, whose golden file holds them as 1713188691477 and 1713189117302
    routes["GET", "/v2/workbooks/wb-1"] = {
        **SIGMA_WORKBOOKS[0],
        "createdAt": "2024-04-15T13:44:51.477Z",
        "updatedAt": "2024-04-15T13:51:57.302Z",
    }
    source.source_config.includeOwners = False

    dashboard = next(source.yield_dashboard(source.get_dashboard_details(Workbook(workbookId="wb-1")))).right

    assert dashboard.lifeCycle == LifeCycle(
        created=AccessDetails(timestamp=1713188691477), updated=AccessDetails(timestamp=1713189117302)
    )


class FakeDashboardProperties:
    """OpenMetadata's dashboard custom properties and the Sigma dashboard, as the server holds them"""

    def __init__(self, properties=(), extension=None):
        self.properties = [{"name": name, "propertyType": {"name": data_type}} for name, data_type in properties]
        self.registered = []
        self.dashboard = LineageDashboard(
            id=uuid5(NAMESPACE_URL, "wb-1"),
            name="wb-1",
            fullyQualifiedName="mock_sigma.wb-1",
            service=EntityReference(id=MOCK_DASHBOARD_SERVICE.id, type="dashboardService"),
            extension=EntityExtension(extension) if extension else None,
        )

    def serve(self, source):
        source.metadata.get_entity_custom_properties = lambda entity_type: self.properties
        source.metadata.get_property_type_ref = lambda data_type: PropertyType(
            EntityReference(id=uuid5(NAMESPACE_URL, data_type.value), type="type", name=data_type.value)
        )
        source.metadata.create_or_update_custom_property = self.register
        source.metadata.get_by_name = lambda entity, fqn, fields=None: (
            self.dashboard if fqn == self.dashboard.fullyQualifiedName.root else None
        )

    def register(self, record):
        request = record.createCustomPropertyRequest
        self.registered.append((request.name.root, request.propertyType.root.name))
        self.properties.append({"name": request.name.root, "propertyType": {"name": request.propertyType.root.name}})


def patched_extension(source, workbook_id="wb-1"):
    """The extension the dashboard holds once the sink applies the workbook's patch"""
    details = source.get_dashboard_details(Workbook(workbookId=workbook_id))
    requests_sent = [either.right for either in source.yield_dashboard_extension(details)]
    if not requests_sent:
        return None
    (request,) = requests_sent
    dashboard_patch = build_patch(
        source=request.original_entity,
        destination=request.new_entity,
        allowed_fields=ALLOWED_COMMON_PATCH_FIELDS,
        restrict_update_fields=RESTRICT_UPDATE_LIST,
        override_metadata=request.override_metadata,
    )
    assert all(op["path"].startswith("/extension") and op["op"] != "remove" for op in dashboard_patch.patch)
    return dashboard_patch.apply(request.original_entity.model_dump(mode="json", exclude_none=True))["extension"]


@pytest.mark.parametrize("version", [3, 1.1])
def test_the_workbook_version_is_patched_onto_its_dashboard(sigma_over_http, routes, version):
    source, _ = sigma_over_http
    source.source_config.includeCustomProperties = True
    routes["GET", "/v2/workbooks/wb-1"] = {**routes["GET", "/v2/workbooks/wb-1"], "latestVersion": version}
    server = FakeDashboardProperties(extension={"team": "finance", "latestVersion": 2})
    server.serve(source)

    assert patched_extension(source) == {"team": "finance", "latestVersion": version}
    assert patched_extension(source, "wb-2") is None
    assert server.registered == [("latestVersion", "number")]


def test_a_latest_version_property_of_another_type_is_left_alone(sigma_over_http):
    source, _ = sigma_over_http
    source.source_config.includeCustomProperties = True
    server = FakeDashboardProperties(properties=[("latestVersion", "string")])
    server.serve(source)

    assert patched_extension(source) is None
    assert server.registered == []


def test_no_workbook_version_is_set_without_custom_properties(sigma_over_http):
    source, _ = sigma_over_http
    server = FakeDashboardProperties()
    server.serve(source)

    assert patched_extension(source) is None
    assert server.registered == []


def test_a_failed_registration_sets_no_version_and_is_not_retried(sigma_over_http):
    source, _ = sigma_over_http
    source.source_config.includeCustomProperties = True
    server = FakeDashboardProperties()
    server.serve(source)
    attempts = []

    def refuse(record):
        attempts.append(record.createCustomPropertyRequest.name.root)
        raise requests.HTTPError("403 Forbidden")

    source.metadata.create_or_update_custom_property = refuse

    assert patched_extension(source) is None
    assert patched_extension(source, "wb-2") is None
    assert attempts == ["latestVersion"]


def test_a_registered_latest_version_property_is_reused(sigma_over_http):
    source, _ = sigma_over_http
    source.source_config.includeCustomProperties = True
    server = FakeDashboardProperties(properties=[("latestVersion", "number")])
    server.serve(source)

    assert patched_extension(source) == {"latestVersion": 3}
    assert server.registered == []


def test_a_failed_dashboard_read_is_reported_for_the_workbook(sigma_over_http):
    source, _ = sigma_over_http
    source.source_config.includeCustomProperties = True
    FakeDashboardProperties().serve(source)

    def unreachable(entity, fqn, fields=None):
        raise requests.ConnectionError("OpenMetadata unreachable")

    source.metadata.get_by_name = unreachable
    details = source.get_dashboard_details(Workbook(workbookId="wb-1"))

    (either,) = source.yield_dashboard_extension(details)
    assert either.right is None
    assert "Sigma workbook wb-1: OpenMetadata unreachable" in either.left.error
