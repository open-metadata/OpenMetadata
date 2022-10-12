import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

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
from metadata.ingestion.source.dashboard.domodashboard import DomodashboardSource

mock_file_path = (
    Path(__file__).parent.parent.parent
    / "resources/datasets/domodashboard_dataset.json"
)
with open(mock_file_path) as file:
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
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest

MOCK_DASHBOARD = {"id": 552315335, "name": "New Dashboard", "children": []}
EXPECTED_DASHBOARD = CreateDashboardRequest(
    name="New Dashboard",
    displayName="New Dashboard",
    description="",
    dashboardUrl="https://domain.domo.com/page/552315335",
    charts=[],
    tags=None,
    owner=None,
    service=EntityReference(
        id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
        type="dashboardService",
        name=None,
        fullyQualifiedName=None,
        description=None,
        displayName=None,
        deleted=None,
        href=None,
    ),
    extension=None,
)

EXPECTED_PIPELINE = [
    CreateChartRequest(
        name="Top Salespeople",
        displayName="Top Salespeople",
        description="TOP SALESPEOPLE\nDisplays the top 10 salespeople by won revenue. Identify over-performers and understand the secrets to their success.",
        chartType="Other",
        chartUrl="https://domain.domo.com/page/552315335/kpi/details/1108771657",
        tables=None,
        tags=None,
        owner=None,
        service=EntityReference(
            id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            type="dashboardService",
            name=None,
            fullyQualifiedName=None,
            description=None,
            displayName=None,
            deleted=None,
            href=None,
        ),
    ),
    CreateChartRequest(
        name="Milan Datasets",
        displayName="Milan Datasets",
        description="",
        chartType="Other",
        chartUrl="https://domain.domo.com/page/552315335/kpi/details/1985861713",
        tables=None,
        tags=None,
        owner=None,
        service=EntityReference(
            id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            type="dashboardService",
            name=None,
            fullyQualifiedName=None,
            description=None,
            displayName=None,
            deleted=None,
            href=None,
        ),
    ),
    CreateChartRequest(
        name="Page Fans",
        displayName="Page Fans",
        description="",
        chartType="Other",
        chartUrl="https://domain.domo.com/page/552315335/kpi/details/2025899139",
        tables=None,
        tags=None,
        owner=None,
        service=EntityReference(
            id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            type="dashboardService",
            name=None,
            fullyQualifiedName=None,
            description=None,
            displayName=None,
            deleted=None,
            href=None,
        ),
    ),
]


class DomoDashboardUnitTest(TestCase):
    @patch("metadata.ingestion.source.dashboard.dashboard_service.test_connection")
    @patch("pydomo.Domo")
    @patch(
        "metadata.clients.domodashboard_client.DomoDashboardClient.get_chart_details"
    )
    def __init__(
        self, methodName, get_chart_details, domo_client, test_connection
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
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
        self.dashboard_list = []
        result = self.domodashboard.yield_dashboard(MOCK_DASHBOARD)
        for r in result:
            if type(r) == CreateDashboardRequest:
                self.dashboard_list.append(r)
        self.assertEqual(EXPECTED_DASHBOARD, self.dashboard_list[0])

    def test_dashboard_name(self):
        assert (
            self.domodashboard.get_dashboard_name(MOCK_DASHBOARD) == mock_data["title"]
        )

    @patch(
        "metadata.clients.domodashboard_client.DomoDashboardClient.get_chart_details"
    )
    def test_chart(self, get_chart_details):
        get_chart_details.return_value = mock_data
        result = self.domodashboard.yield_dashboard_chart(MOCK_DASHBOARD)
        self.chart_list = []
        for r in result:
            if type(r) == CreateChartRequest:
                self.chart_list.append(r)
        for i in range(len(EXPECTED_PIPELINE)):
            assert EXPECTED_PIPELINE[i] == self.chart_list[i]
