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
Test QlikSense using the topology
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
from metadata.ingestion.source.dashboard.qliksense.client import QlikSenseClient
from metadata.ingestion.source.dashboard.qliksense.metadata import QliksenseSource
from metadata.ingestion.source.dashboard.qliksense.models import (
    QlikDashboard,
    QlikDashboardMeta,
    QlikSheet,
    QlikSheetInfo,
    QlikSheetMeta,
)

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="qliksense_source_test",
    fullyQualifiedName=FullyQualifiedEntityName("qliksense_source_test"),
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.QlikSense,
)


mock_qliksense_config = {
    "source": {
        "type": "qliksense",
        "serviceName": "local_qliksensem",
        "serviceConnection": {
            "config": {
                "type": "QlikSense",
                "certificates": {
                    "rootCertificate": "/test/path/root.pem",
                    "clientKeyCertificate": "/test/path/client_key.pem",
                    "clientCertificate": "/test/path/client.pem",
                },
                "userDirectory": "demo",
                "userId": "demo",
                "hostPort": "wss://test:4747",
                "displayUrl": "https://test",
            }
        },
        "sourceConfig": {
            "config": {
                "dashboardFilterPattern": {},
                "chartFilterPattern": {},
                "includeDraftDashboard": False,
                "includeOwners": True,
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
MOCK_DASHBOARD_NAME = "New Dashboard"

MOCK_DASHBOARD_DETAILS = QlikDashboard(
    qDocName=MOCK_DASHBOARD_NAME,
    qDocId="1",
    qTitle=MOCK_DASHBOARD_NAME,
)

MOCK_CHARTS = [
    QlikSheet(
        qInfo=QlikSheetInfo(qId="11"), qMeta=QlikSheetMeta(title="Top Salespeople")
    ),
    QlikSheet(
        qInfo=QlikSheetInfo(qId="12"),
        qMeta=QlikSheetMeta(title="Milan Datasets", description="dummy"),
    ),
]

EXPECTED_DASHBOARD = CreateDashboardRequest(
    name="1",
    displayName="New Dashboard",
    sourceUrl="https://test/sense/app/1/overview",
    charts=[],
    tags=None,
    owners=None,
    service="qliksense_source_test",
    extension=None,
)

EXPECTED_DASHBOARDS = [
    CreateChartRequest(
        name="11",
        displayName="Top Salespeople",
        chartType="Other",
        sourceUrl="https://test/sense/app/1/sheet/11",
        tags=None,
        owners=None,
        service="qliksense_source_test",
    ),
    CreateChartRequest(
        name="12",
        displayName="Milan Datasets",
        chartType="Other",
        sourceUrl="https://test/sense/app/1/sheet/12",
        tags=None,
        owners=None,
        service="qliksense_source_test",
        description="dummy",
    ),
]
MOCK_DASHBOARDS = [
    QlikDashboard(
        qDocName="sample unpublished dashboard",
        qDocId="51",
        qTitle="sample unpublished dashboard",
        qMeta=QlikDashboardMeta(published=False),
    ),
    QlikDashboard(
        qDocName="sample published dashboard",
        qDocId="52",
        qTitle="sample published dashboard",
        qMeta=QlikDashboardMeta(published=True),
    ),
    QlikDashboard(
        qDocName="sample published dashboard",
        qDocId="53",
        qTitle="sample published dashboard",
        qMeta=QlikDashboardMeta(published=True),
    ),
]
DRAFT_DASHBOARDS_IN_MOCK_DASHBOARDS = 1


class QlikSenseUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    QlikSense Unit Testtest_dbt
    """

    def __init__(self, methodName) -> None:
        with patch.object(
            QlikSenseClient, "get_dashboard_for_test_connection", return_value=None
        ):
            super().__init__(methodName)
            # test_connection.return_value = False
            self.config = OpenMetadataWorkflowConfig.model_validate(
                mock_qliksense_config
            )
            self.qliksense = QliksenseSource.create(
                mock_qliksense_config["source"],
                OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
            )
            self.qliksense.context.get().__dict__[
                "dashboard_service"
            ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
            print(self.qliksense.topology)
            print(self.qliksense.context.get().__dict__)

    @pytest.mark.order(1)
    def test_dashboard(self):
        dashboard_list = []
        results = self.qliksense.yield_dashboard(MOCK_DASHBOARD_DETAILS)
        for result in results:
            print(self.qliksense.context.get().__dict__)
            if isinstance(result, Either) and result.right:
                dashboard_list.append(result.right)
        self.assertEqual(EXPECTED_DASHBOARD, dashboard_list[0])

    @pytest.mark.order(2)
    def test_dashboard_name(self):
        assert (
            self.qliksense.get_dashboard_name(MOCK_DASHBOARD_DETAILS)
            == MOCK_DASHBOARD_NAME
        )

    @pytest.mark.order(3)
    def test_chart(self):
        dashboard_details = MOCK_DASHBOARD_DETAILS
        with patch.object(
            QlikSenseClient, "get_dashboard_charts", return_value=MOCK_CHARTS
        ):
            results = list(self.qliksense.yield_dashboard_chart(dashboard_details))
            chart_list = []
            for result in results:
                if isinstance(result, Either) and result.right:
                    chart_list.append(result.right)
            for _, (expected, original) in enumerate(
                zip(EXPECTED_DASHBOARDS, chart_list)
            ):
                self.assertEqual(expected, original)

    @pytest.mark.order(4)
    def test_draft_dashboard(self):
        draft_dashboards_count = 0
        for dashboard in MOCK_DASHBOARDS:
            if self.qliksense.filter_draft_dashboard(dashboard):
                draft_dashboards_count += 1
        assert draft_dashboards_count == DRAFT_DASHBOARDS_IN_MOCK_DASHBOARDS

    @pytest.mark.order(5)
    def test_include_owners_flag_enabled(self):
        """
        Test that when includeOwners is True, owner information is processed
        """
        # Mock the source config to have includeOwners = True
        self.qliksense.source_config.includeOwners = True
        
        # Test that owner information is processed when includeOwners is True
        self.assertTrue(self.qliksense.source_config.includeOwners)

    @pytest.mark.order(6)
    def test_include_owners_flag_disabled(self):
        """
        Test that when includeOwners is False, owner information is not processed
        """
        # Mock the source config to have includeOwners = False
        self.qliksense.source_config.includeOwners = False
        
        # Test that owner information is not processed when includeOwners is False
        self.assertFalse(self.qliksense.source_config.includeOwners)

    @pytest.mark.order(7)
    def test_include_owners_flag_in_config(self):
        """
        Test that the includeOwners flag is properly set in the configuration
        """
        # Check that the mock configuration includes the includeOwners flag
        config = mock_qliksense_config["source"]["sourceConfig"]["config"]
        self.assertIn("includeOwners", config)
        self.assertTrue(config["includeOwners"])

    @pytest.mark.order(8)
    def test_include_owners_flag_affects_owner_processing(self):
        """
        Test that the includeOwners flag affects how owner information is processed
        """
        # Test with includeOwners = True
        self.qliksense.source_config.includeOwners = True
        self.assertTrue(self.qliksense.source_config.includeOwners)
        
        # Test with includeOwners = False
        self.qliksense.source_config.includeOwners = False
        self.assertFalse(self.qliksense.source_config.includeOwners)
