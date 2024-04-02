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
Test QlikCloud using the topology
"""

from unittest import TestCase
from unittest.mock import patch

import pytest

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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.qlikcloud.client import QlikCloudClient
from metadata.ingestion.source.dashboard.qlikcloud.metadata import QlikcloudSource
from metadata.ingestion.source.dashboard.qlikcloud.models import QlikApp
from metadata.ingestion.source.dashboard.qliksense.models import (
    QlikSheet,
    QlikSheetInfo,
    QlikSheetMeta,
)

mock_qlikcloud_config = {
    "source": {
        "type": "qlikcloud",
        "serviceName": "local_qlikcloud",
        "serviceConnection": {
            "config": {
                "type": "QlikCloud",
                "hostPort": "https://test",
                "token": "token",
            }
        },
        "sourceConfig": {
            "config": {
                "includeDraftDashboard": False,
            }
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

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="qlikcloud_source_test",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="qlikcloud_source_test"),
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.QlikCloud,
)

MOCK_DASHBOARD_NAME = "Product Data"

MOCK_DASHBOARD_DETAILS = QlikApp(
    name=MOCK_DASHBOARD_NAME,
    id="14",
    description="product data details",
)

EXPECTED_DASHBOARD = CreateDashboardRequest(
    name="14",
    displayName="Product Data",
    description="product data details",
    sourceUrl="https://test/sense/app/14/overview",
    charts=[],
    tags=None,
    owner=None,
    service="qlikcloud_source_test",
    extension=None,
)

MOCK_CHARTS = [
    QlikSheet(qInfo=QlikSheetInfo(qId="9"), qMeta=QlikSheetMeta(title="FY 22 Data")),
    QlikSheet(
        qInfo=QlikSheetInfo(qId="10"),
        qMeta=QlikSheetMeta(title="Car Sales", description="American car sales data"),
    ),
]

EXPECTED_CHARTS = [
    CreateChartRequest(
        name="9",
        displayName="FY 22 Data",
        chartType="Other",
        sourceUrl="https://test/sense/app/14/sheet/9",
        tags=None,
        owner=None,
        service="qlikcloud_source_test",
    ),
    CreateChartRequest(
        name="10",
        displayName="Car Sales",
        chartType="Other",
        sourceUrl="https://test/sense/app/14/sheet/10",
        tags=None,
        owner=None,
        service="qlikcloud_source_test",
        description="American car sales data",
    ),
]

MOCK_DASHBOARDS = [
    QlikApp(
        name="sample unpublished dashboard",
        id="201",
        description="sample unpublished dashboard",
        published=False,
    ),
    QlikApp(
        name="sample published dashboard",
        id="202",
        description="sample published dashboard",
        published=True,
    ),
    QlikApp(
        name="sample published dashboard",
        id="203",
        description="sample published dashboard",
        published=True,
    ),
]
DRAFT_DASHBOARDS_IN_MOCK_DASHBOARDS = 1


class QlikCloudUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Qlikcloud Unit Testtest_dbt
    """

    def __init__(self, methodName) -> None:
        with patch.object(QlikCloudClient, "get_dashboards_list", return_value=None):
            super().__init__(methodName)
            # test_connection.return_value = False
            self.config = OpenMetadataWorkflowConfig.parse_obj(mock_qlikcloud_config)
            self.qlikcloud = QlikcloudSource.create(
                mock_qlikcloud_config["source"],
                OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
            )
            self.qlikcloud.context.get().__dict__[
                "dashboard_service"
            ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.__root__
            self.qlikcloud.context.get().__dict__["project_name"] = None

    @pytest.mark.order(1)
    def test_dashboard(self):
        dashboard_list = []
        results = self.qlikcloud.yield_dashboard(MOCK_DASHBOARD_DETAILS)
        for result in results:
            print(self.qlikcloud.context.get().__dict__)
            if isinstance(result, Either) and result.right:
                dashboard_list.append(result.right)

        self.assertEqual(EXPECTED_DASHBOARD, dashboard_list[0])

    @pytest.mark.order(2)
    def test_dashboard_name(self):
        assert (
            self.qlikcloud.get_dashboard_name(MOCK_DASHBOARD_DETAILS)
            == MOCK_DASHBOARD_NAME
        )

    @pytest.mark.order(3)
    def test_chart(self):
        dashboard_details = MOCK_DASHBOARD_DETAILS
        with patch.object(
            QlikCloudClient, "get_dashboard_charts", return_value=MOCK_CHARTS
        ):
            results = list(self.qlikcloud.yield_dashboard_chart(dashboard_details))
            chart_list = []
            for result in results:
                if isinstance(result, Either) and result.right:
                    chart_list.append(result.right)
            for _, (expected, original) in enumerate(zip(EXPECTED_CHARTS, chart_list)):
                self.assertEqual(expected, original)

    @pytest.mark.order(4)
    def test_draft_dashboard(self):
        draft_dashboards_count = 0
        for dashboard in MOCK_DASHBOARDS:
            if self.qlikcloud.filter_draft_dashboard(dashboard):
                draft_dashboards_count += 1
        assert draft_dashboards_count == DRAFT_DASHBOARDS_IN_MOCK_DASHBOARDS
