"""
Test Domo Dashboard using the topology
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.source.dashboard.tableau.metadata import (
    TableauChart,
    TableauDashboard,
    TableauOwner,
    TableauSource,
)

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="tableau_source_test"),
    name="tableau_source_test",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Tableau,
)

mock_tableau_config = {
    "source": {
        "type": "tableau",
        "serviceName": "test2",
        "serviceConnection": {
            "config": {
                "type": "Tableau",
                "username": "username",
                "password": "abcdefg",
                "env": "tableau_env",
                "hostPort": "http://tableauHost.com",
                "siteName": "tableauSiteName",
                "siteUrl": "tableauSiteUrl",
                "apiVersion": "3.19",
                "personalAccessTokenName": "tableau",
                "personalAccessTokenSecret": "tableauPersonalAccessToken",
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

MOCK_DASHBOARD = TableauDashboard(
    id="42a5b706-739d-4d62-94a2-faedf33950a5",
    name="Regional",
    webpage_url="https://prod-apnortheast-a.online.tableau.com/#/site/hidarsite/workbooks/897790",
    description="tableau dashboard description",
    tags=[],
    owner=TableauOwner(
        id="1234", name="Dashboard Owner", email="samplemail@sample.com"
    ),
    charts=[
        TableauChart(
            id="b05695a2-d1ea-428e-96b2-858809809da4",
            name="Obesity",
            workbook_id="42a5b706-739d-4d62-94a2-faedf33950a5",
            sheet_type="dashboard",
            view_url_name="Obesity",
            content_url="Regional/sheets/Obesity",
            tags=[],
        ),
        TableauChart(
            id="106ff64d-537b-4534-8140-5d08c586e077",
            name="College",
            workbook_id="42a5b706-739d-4d62-94a2-faedf33950a5",
            sheet_type="view",
            view_url_name="College",
            content_url="Regional/sheets/College",
            tags=[],
        ),
        TableauChart(
            id="c1493abc-9057-4bdf-9061-c6d2908e4eaa",
            name="Global Temperatures",
            workbook_id="42a5b706-739d-4d62-94a2-faedf33950a5",
            sheet_type="dashboard",
            view_url_name="GlobalTemperatures",
            content_url="Regional/sheets/GlobalTemperatures",
            tags=[],
        ),
    ],
)

EXPECTED_DASHBOARD = CreateDashboardRequest(
    name="42a5b706-739d-4d62-94a2-faedf33950a5",
    displayName="Regional",
    description="tableau dashboard description",
    dashboardUrl="#/site/hidarsite/workbooks/897790",
    charts=[],
    tags=[],
    owner=None,
    service=FullyQualifiedEntityName(__root__="tableau_source_test"),
    extension=None,
)

EXPECTED_CHARTS = [
    CreateChartRequest(
        name="b05695a2-d1ea-428e-96b2-858809809da4",
        displayName="Obesity",
        description=None,
        chartType="Other",
        chartUrl="#site/tableauSiteUrl/views/Regional/Obesity",
        tables=None,
        tags=[],
        owner=None,
        service=FullyQualifiedEntityName(__root__="tableau_source_test"),
    ),
    CreateChartRequest(
        name="106ff64d-537b-4534-8140-5d08c586e077",
        displayName="College",
        description=None,
        chartType="Other",
        chartUrl="#site/tableauSiteUrl/views/Regional/College",
        tables=None,
        tags=[],
        owner=None,
        service=FullyQualifiedEntityName(__root__="tableau_source_test"),
    ),
    CreateChartRequest(
        name="c1493abc-9057-4bdf-9061-c6d2908e4eaa",
        displayName="Global Temperatures",
        description=None,
        chartType="Other",
        chartUrl="#site/tableauSiteUrl/views/Regional/GlobalTemperatures",
        tables=None,
        tags=[],
        owner=None,
        service=FullyQualifiedEntityName(__root__="tableau_source_test"),
    ),
]


class TableauUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Domo Dashboard Unit Test
    """

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    @patch("tableau_api_lib.tableau_server_connection.TableauServerConnection")
    @patch("metadata.ingestion.source.dashboard.tableau.connection.get_connection")
    def __init__(
        self, methodName, get_connection, tableau_server_connection, test_connection
    ) -> None:
        super().__init__(methodName)
        get_connection.return_value = False
        tableau_server_connection.return_value = False
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_tableau_config)
        self.tableau = TableauSource.create(
            mock_tableau_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.tableau.context.__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE

    def test_dashboard(self):
        self.assertEqual(
            next(self.tableau.yield_dashboard(MOCK_DASHBOARD)),
            EXPECTED_DASHBOARD,
        )

    def test_dashboard_name(self):
        assert self.tableau.get_dashboard_name(MOCK_DASHBOARD) == MOCK_DASHBOARD.name

    def test_yield_chart(self):
        """
        Function for testing charts
        """
        chart_list = []
        results = self.tableau.yield_dashboard_chart(MOCK_DASHBOARD)
        for result in results:
            if isinstance(result, CreateChartRequest):
                chart_list.append(result)

        for _, (exptected, original) in enumerate(zip(EXPECTED_CHARTS, chart_list)):
            self.assertEqual(exptected, original)
