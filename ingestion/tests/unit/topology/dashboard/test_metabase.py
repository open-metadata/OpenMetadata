#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

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
from metadata.ingestion.source.dashboard.metabase.metadata import MetabaseSource
from metadata.ingestion.source.dashboard.metabase.models import (
    MetabaseChart,
    MetabaseDashboardDetails,
    OrderedCard,
)

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="mock_metabase"),
    name="mock_metabase",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Metabase,
)

mock_tableau_config = {
    "source": {
        "type": "metabase",
        "serviceName": "mock_metabase",
        "serviceConnection": {
            "config": {
                "type": "Metabase",
                "username": "username",
                "password": "abcdefg",
                "hostPort": "http://metabase.com",
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


MOCK_CHARTS = [
    OrderedCard(
        card=MetabaseChart(
            description="Test Chart",
            table_id=1,
            database_id=1,
            name="chart1",
            id="1",
            display="chart1",
        )
    ),
    OrderedCard(
        card=MetabaseChart(
            description="Test Chart",
            table_id=1,
            database_id=1,
            name="chart2",
            id="2",
            display="chart2",
        )
    ),
    OrderedCard(card=MetabaseChart(name="chart3", id="3")),
]

MOCK_DASHBOARD_DETAILS = MetabaseDashboardDetails(
    description="SAMPLE DESCRIPTION", name="test_db", id="1", ordered_cards=MOCK_CHARTS
)


EXPECTED_DASHBOARD = [
    CreateDashboardRequest(
        name="42a5b706-739d-4d62-94a2-faedf33950a5",
        displayName="Regional",
        description="tableau dashboard description",
        dashboardUrl="#/site/hidarsite/workbooks/897790",
        charts=[],
        tags=[],
        owner=None,
        service=FullyQualifiedEntityName(__root__="mock_metabase"),
        extension=None,
    )
]

EXPECTED_CHARTS = [
    CreateChartRequest(
        name="1",
        displayName="chart1",
        description="Test Chart",
        chartType="Other",
        chartUrl="http://metabase.com/question/1-chart1",
        tags=None,
        owner=None,
        service=FullyQualifiedEntityName(__root__="mock_metabase"),
    ),
    CreateChartRequest(
        name="2",
        displayName="chart2",
        description="Test Chart",
        chartType="Other",
        chartUrl="http://metabase.com/question/2-chart2",
        tags=None,
        owner=None,
        service=FullyQualifiedEntityName(__root__="mock_metabase"),
    ),
    CreateChartRequest(
        name="3",
        displayName="chart3",
        description=None,
        chartType="Other",
        chartUrl="http://metabase.com/question/3-chart3",
        tags=None,
        owner=None,
        service=FullyQualifiedEntityName(__root__="mock_metabase"),
    ),
]


class MetabaseUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Domo Dashboard Unit Test
    """

    @patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.dashboard.metabase.connection.get_connection")
    def __init__(self, methodName, get_connection, test_connection) -> None:
        super().__init__(methodName)
        get_connection.return_value = False
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_tableau_config)
        self.metabase = MetabaseSource.create(
            mock_tableau_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.metabase.context.__dict__["dashboard_service"] = MOCK_DASHBOARD_SERVICE

    def test_dashboard_name(self):
        assert (
            self.metabase.get_dashboard_name(MOCK_DASHBOARD_DETAILS)
            == MOCK_DASHBOARD_DETAILS.name
        )

    def test_yield_chart(self):
        """
        Function for testing charts
        """
        chart_list = []
        results = self.metabase.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS)
        for result in results:
            if isinstance(result, CreateChartRequest):
                chart_list.append(result)

        for exptected, original in zip(EXPECTED_CHARTS, chart_list):
            self.assertEqual(exptected, original)
