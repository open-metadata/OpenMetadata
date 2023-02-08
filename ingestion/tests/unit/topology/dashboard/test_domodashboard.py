"""
Test Domo Dashboard using the topology
"""

import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

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
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.source.dashboard.domodashboard.metadata import (
    DomoDashboardDetails,
    DomodashboardSource,
)

mock_file_path = (
    Path(__file__).parent.parent.parent
    / "resources/datasets/domodashboard_dataset.json"
)
with open(mock_file_path, encoding="UTF-8") as file:
    mock_data: dict = json.load(file)

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="domodashboard_source_test",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.DomoDashboard,
)

MOCK_DASHBOARD = Dashboard(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="do_it_all_with_default_config",
    fullyQualifiedName="domodashboard_source.do_it_all_with_default_config",
    displayName="do_it_all_with_default_config",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="dashboardService"
    ),
)

mock_domopipeline_config = {
    "source": {
        "type": "domodashboard",
        "serviceName": "test2",
        "serviceConnection": {
            "config": {
                "type": "DomoDashboard",
                "clientId": "00000",
                "secretToken": "abcdefg",
                "accessToken": "accessTpokem",
                "apiHost": "api.domo.com",
                "sandboxDomain": "https://domain.domo.com",
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
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

MOCK_DASHBOARD = DomoDashboardDetails(
    id=552315335,
    name="New Dashboard",
    cardIds=["1982511286", "781210736"],
    collection_ids=[],
    owners=[],
)

EXPECTED_DASHBOARD = CreateDashboardRequest(
    name="552315335",
    displayName="New Dashboard",
    description=None,
    dashboardUrl="https://domain.domo.com/page/552315335",
    charts=[],
    tags=None,
    owner=None,
    service="domodashboard_source_test",
    extension=None,
)

EXPECTED_CHARTS = [
    CreateChartRequest(
        name="1982511286",
        displayName="New Dashboard",
        description=(
            "TOP SALESPEOPLE\nDisplays the top 10 salespeople by won revenue."
            " Identify over-performers and understand the secrets to their success."
        ),
        chartType="Other",
        chartUrl="https://domain.domo.com/page/552315335/kpis/details/1982511286",
        tables=None,
        tags=None,
        owner=None,
        service="domodashboard_source_test",
    ),
    CreateChartRequest(
        name="781210736",
        displayName="New Dashboard",
        description=(
            "TOP SALESPEOPLE\nDisplays the top 10 salespeople by won revenue."
            " Identify over-performers and understand the secrets to their success."
        ),
        chartType="Other",
        chartUrl="https://domain.domo.com/page/552315335/kpis/details/781210736",
        tables=None,
        tags=None,
        owner=None,
        service="domodashboard_source_test",
    ),
]


class DomoDashboardUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Domo Dashboard Unit Test
    """

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    @patch("pydomo.Domo")
    def __init__(self, methodName, domo_client, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        domo_client.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_domopipeline_config)
        self.domodashboard = DomodashboardSource.create(
            mock_domopipeline_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.domodashboard.context.__dict__["dashboard"] = MOCK_DASHBOARD
        self.domodashboard.context.__dict__[
            "dashboard_service"
        ] = MOCK_DASHBOARD_SERVICE

    def test_dashboard(self):
        dashboard_list = []
        results = self.domodashboard.yield_dashboard(MOCK_DASHBOARD)
        for result in results:
            if isinstance(result, CreateDashboardRequest):
                dashboard_list.append(result)
        self.assertEqual(EXPECTED_DASHBOARD, dashboard_list[0])

    def test_dashboard_name(self):
        assert (
            self.domodashboard.get_dashboard_name(MOCK_DASHBOARD)
            == mock_data[0][0]["title"]
        )

    def test_chart(self):
        """
        Function for testing charts
        """
        with patch.object(REST, "_request", return_value=mock_data[0]):
            results = self.domodashboard.yield_dashboard_chart(MOCK_DASHBOARD)
            chart_list = []
            for result in results:
                if isinstance(result, CreateChartRequest):
                    chart_list.append(result)
            for _, (expected, original) in enumerate(zip(EXPECTED_CHARTS, chart_list)):
                self.assertEqual(expected, original)

        with patch.object(REST, "_request", return_value=mock_data[1]):
            result = self.domodashboard.domo_client.get_chart_details(
                MOCK_DASHBOARD.cardIds[0]
            )
            assert (
                self.domodashboard.domo_client.get_chart_details(
                    MOCK_DASHBOARD.cardIds[0]
                )
                is None
            )

        with patch.object(REST, "_request", return_value=mock_data[2]):
            assert (
                self.domodashboard.domo_client.get_chart_details(
                    MOCK_DASHBOARD.cardIds[0]
                )
                is None
            )
