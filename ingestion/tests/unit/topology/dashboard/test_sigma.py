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
from unittest.mock import patch

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
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Markdown
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.sigma.metadata import SigmaSource
from metadata.ingestion.source.dashboard.sigma.models import Elements, WorkbookDetails

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
    connection=DatabaseConnection(),
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
