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
Test Domo Dashboard using the topology
"""

import json
from pathlib import Path
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
from metadata.ingestion.api.models import Either
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
    fullyQualifiedName=FullyQualifiedEntityName("domodashboard_source_test"),
    name="domodashboard_source_test",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.DomoDashboard,
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
                "instanceDomain": "https://domain.domo.com",
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
    id="552315335",
    name="New Dashboard",
    cardIds=["1982511286", "781210736"],
    collection_ids=[],
    owners=[],
)

EXPECTED_DASHBOARD = CreateDashboardRequest(
    name="552315335",
    displayName="New Dashboard",
    description=None,
    sourceUrl="https://domain.domo.com/page/552315335",
    charts=[],
    tags=None,
    owners=None,
    service=FullyQualifiedEntityName("domodashboard_source_test"),
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
        sourceUrl="https://domain.domo.com/page/552315335/kpis/details/1982511286",
        tags=None,
        owners=None,
        service=FullyQualifiedEntityName("domodashboard_source_test"),
    ),
    CreateChartRequest(
        name="781210736",
        displayName="New Dashboard",
        description=(
            "TOP SALESPEOPLE\nDisplays the top 10 salespeople by won revenue."
            " Identify over-performers and understand the secrets to their success."
        ),
        chartType="Other",
        sourceUrl="https://domain.domo.com/page/552315335/kpis/details/781210736",
        tags=None,
        owners=None,
        service=FullyQualifiedEntityName("domodashboard_source_test"),
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
        self.config = OpenMetadataWorkflowConfig.model_validate(
            mock_domopipeline_config
        )
        self.domodashboard = DomodashboardSource.create(
            mock_domopipeline_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.domodashboard.context.get().__dict__["dashboard"] = MOCK_DASHBOARD.name
        self.domodashboard.context.get().__dict__[
            "dashboard_service"
        ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root

    def test_dashboard(self):
        dashboard_list = []
        results = self.domodashboard.yield_dashboard(MOCK_DASHBOARD)
        for result in results:
            if isinstance(result, Either) and result.right:
                dashboard_list.append(result.right)
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
                if isinstance(result, Either) and result.right:
                    chart_list.append(result.right)
            for _, (expected, original) in enumerate(zip(EXPECTED_CHARTS, chart_list)):
                self.assertEqual(expected, original)

        # Cover error responses
        with patch.object(REST, "_request", return_value=mock_data[1]):
            assert (
                self.domodashboard.client.custom.get_chart_details(
                    MOCK_DASHBOARD.cardIds[0]
                )
                is None
            )

        with patch.object(REST, "_request", return_value=mock_data[2]):
            assert (
                self.domodashboard.client.custom.get_chart_details(
                    MOCK_DASHBOARD.cardIds[0]
                )
                is None
            )
