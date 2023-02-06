"""
Test QuickSight using the topology
"""

import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.dashboard.quicksight.metadata import QuicksightSource

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/quicksight_dataset.json"
)
with open(mock_file_path, encoding="UTF-8") as file:
    mock_data: dict = json.load(file)

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="quicksight_source_test",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.QuickSight,
)

MOCK_DASHBOARD = Dashboard(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="do_it_all_with_default_config",
    fullyQualifiedName="quicksight_source.do_it_all_with_default_config",
    displayName="do_it_all_with_default_config",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="dashboardService"
    ),
)

mock_quicksight_config = {
    "source": {
        "type": "quicksight",
        "serviceName": "local_quicksight",
        "serviceConnection": {
            "config": {
                "type": "QuickSight",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
                "awsAccountId": "6733-5329-5256",
            }
        },
        "sourceConfig": {
            "config": {"dashboardFilterPattern": {}, "chartFilterPattern": {}}
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

MOCK_DASHBOARD_DETAILS = {
    "DashboardId": "552315335",
    "Name": "New Dashboard",
    "Version": {
        "Sheets": [],
    },
}
EXPECTED_DASHBOARD = CreateDashboardRequest(
    name="552315335",
    displayName="New Dashboard",
    description="",
    dashboardUrl="https://dashboards.example.com/embed/1234",
    charts=[],
    tags=None,
    owner=None,
    service="quicksight_source_test",
    extension=None,
)

EXPECTED_DASHBOARDS = [
    CreateChartRequest(
        name="1108771657",
        displayName="Top Salespeople",
        description="",
        chartType="Other",
        chartUrl="https://dashboards.example.com/embed/1234/sheets/1108771657",
        tables=None,
        tags=None,
        owner=None,
        service="quicksight_source_test",
    ),
    CreateChartRequest(
        name="1985861713",
        displayName="Milan Datasets",
        description="",
        chartType="Other",
        chartUrl="https://dashboards.example.com/embed/1234/sheets/1985861713",
        tables=None,
        tags=None,
        owner=None,
        service="quicksight_source_test",
    ),
    CreateChartRequest(
        name="2025899139",
        displayName="Page Fans",
        description="",
        chartType="Other",
        chartUrl="https://dashboards.example.com/embed/1234/sheets/2025899139",
        tables=None,
        tags=None,
        owner=None,
        service="quicksight_source_test",
    ),
]


def mock_get_dashboard_embed_url(AwsAccountId, DashboardId, IdentityType, Namespace):
    return {"EmbedUrl": "https://dashboards.example.com/embed/1234"}


class QuickSightUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    QuickSight Unit Test
    """

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_quicksight_config)
        self.quicksight = QuicksightSource.create(
            mock_quicksight_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.quicksight.dashboard_url = "https://dashboards.example.com/embed/1234"
        self.quicksight.context.__dict__["dashboard"] = MOCK_DASHBOARD
        self.quicksight.context.__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE
        self.quicksight.client.get_dashboard_embed_url = mock_get_dashboard_embed_url

    @pytest.mark.order(1)
    def test_dashboard(self):
        dashboard_list = []
        results = self.quicksight.yield_dashboard(MOCK_DASHBOARD_DETAILS)
        for result in results:
            if isinstance(result, CreateDashboardRequest):
                dashboard_list.append(result)
        self.assertEqual(EXPECTED_DASHBOARD, dashboard_list[0])

    @pytest.mark.order(2)
    def test_dashboard_name(self):
        assert (
            self.quicksight.get_dashboard_name(MOCK_DASHBOARD_DETAILS)
            == mock_data["Name"]
        )

    @pytest.mark.order(3)
    def test_chart(self):
        dashboard_details = MOCK_DASHBOARD_DETAILS
        dashboard_details["Version"]["Sheets"] = mock_data["Version"]["Sheets"]
        results = self.quicksight.yield_dashboard_chart(dashboard_details)
        chart_list = []
        for result in results:
            if isinstance(result, CreateChartRequest):
                chart_list.append(result)
        for _, (expected, original) in enumerate(zip(EXPECTED_DASHBOARDS, chart_list)):
            self.assertEqual(expected, original)
