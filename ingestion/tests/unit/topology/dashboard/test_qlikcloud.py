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
Test QlikCloud using the topology
"""

from unittest import TestCase
from unittest.mock import patch

import pytest

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.services.connections.dashboard.qlikCloudConnection import (
    SpaceType,
)
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
from metadata.ingestion.source.dashboard.qlikcloud.models import (
    QlikApp,
    QlikSpace,
    QlikSpaceType,
)
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

MOCK_MANAGED_PROJECT_1_ID = "100"
MOCK_MANAGED_PROJECT_2_ID = "101"
MOCK_SHARED_PROJECT_1_ID = "102"
MOCK_PERSONAL_PROJECT_ID = ""
MOCK_PROJECTS = [
    QlikSpace(
        name="managed-space-1",
        description="managed space",
        id=MOCK_MANAGED_PROJECT_1_ID,
        type=QlikSpaceType.MANAGED,
    ),
    QlikSpace(
        name="managed-space-2",
        description="managed space",
        id=MOCK_MANAGED_PROJECT_2_ID,
        type=QlikSpaceType.MANAGED,
    ),
    QlikSpace(
        name="shared-space-1",
        description="shared space",
        id=MOCK_SHARED_PROJECT_1_ID,
        type=QlikSpaceType.SHARED,
    ),
]
MOCK_PERSONAL_PROJECT = QlikSpace(
    name="Personal",
    description="Represents personal space of QlikCloud.",
    id=MOCK_PERSONAL_PROJECT_ID,
    type=QlikSpaceType.PERSONAL,
)
MOCK_PROJECTS_MAP = {
    MOCK_MANAGED_PROJECT_1_ID: MOCK_PROJECTS[0],
    MOCK_MANAGED_PROJECT_2_ID: MOCK_PROJECTS[1],
    MOCK_SHARED_PROJECT_1_ID: MOCK_PROJECTS[2],
    MOCK_PERSONAL_PROJECT_ID: MOCK_PERSONAL_PROJECT,
}

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="qlikcloud_source_test",
    fullyQualifiedName=FullyQualifiedEntityName("qlikcloud_source_test"),
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
    owners=None,
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
        owners=None,
        service="qlikcloud_source_test",
    ),
    CreateChartRequest(
        name="10",
        displayName="Car Sales",
        chartType="Other",
        sourceUrl="https://test/sense/app/14/sheet/10",
        tags=None,
        owners=None,
        service="qlikcloud_source_test",
        description="American car sales data",
    ),
]

MOCK_DASHBOARDS = [
    QlikApp(
        name="sample managed app's unpublished dashboard",
        id="201",
        description="sample managed app's unpublished dashboard",
        published=False,
        spaceId=MOCK_MANAGED_PROJECT_1_ID,
    ),
    QlikApp(
        name="sample managed app's published dashboard",
        id="202",
        description="sample managed app's published dashboard",
        published=True,
        spaceId=MOCK_MANAGED_PROJECT_1_ID,
    ),
    QlikApp(
        name="sample managed app's published dashboard",
        id="203",
        description="sample managed app's published dashboard",
        published=True,
        spaceId=MOCK_MANAGED_PROJECT_2_ID,
    ),
    QlikApp(
        name="sample shared app's unpublished dashboard",
        id="204",
        description="sample shared app's unpublished dashboard",
        published=False,
        spaceId=MOCK_SHARED_PROJECT_1_ID,
    ),
    QlikApp(
        name="sample shared app's published dashboard",
        id="205",
        description="sample shared app's published dashboard",
        published=True,
        spaceId=MOCK_SHARED_PROJECT_1_ID,
    ),
    QlikApp(
        name="sample personal app's published dashboard",
        id="206",
        description="sample personal app's published dashboard",
        published=True,
        spaceId=MOCK_PERSONAL_PROJECT_ID,
    ),
]
DRAFT_DASHBOARDS_IN_MOCK_DASHBOARDS = 2
MANAGED_APP_DASHBOARD_IN_MOCK_DASHBOARDS = 3
SHARED_APP_DASHBOARD_IN_MOCK_DASHBOARDS = 2
PERSONAL_APP_DASHBOARD_IN_MOCK_DASHBOARDS = 1


class QlikCloudUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Qlikcloud Unit Testtest_dbt
    """

    def __init__(self, methodName) -> None:
        with patch.object(
            QlikCloudClient, "get_dashboards_list", return_value=None
        ), patch.object(
            QlikCloudClient, "get_dashboards_list_test_conn", return_value=None
        ):
            super().__init__(methodName)
            # test_connection.return_value = False
            self.config = OpenMetadataWorkflowConfig.model_validate(
                mock_qlikcloud_config
            )
            self.qlikcloud = QlikcloudSource.create(
                mock_qlikcloud_config["source"],
                OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
            )
            self.qlikcloud.context.get().__dict__[
                "dashboard_service"
            ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.root
            self.qlikcloud.context.get().__dict__["project_name"] = None

    @pytest.mark.order(0)
    def test_prepare(self):
        with patch.object(
            QlikCloudClient, "get_projects_list", return_value=MOCK_PROJECTS
        ):
            self.qlikcloud.prepare()

        assert len(self.qlikcloud.projects_map) == len(MOCK_PROJECTS_MAP), (
            f"Expected projects_map to have {len(MOCK_PROJECTS_MAP) + 1} entries, "
            f"but got {len(self.qlikcloud.projects_map)}"
        )

        for space_id, expected_space in MOCK_PROJECTS_MAP.items():
            mapped_space = self.qlikcloud.projects_map.get(space_id)
            assert (
                mapped_space == expected_space
            ), f"Expected {expected_space} for spaceId {space_id}, but got {mapped_space}"

        personal_space = self.qlikcloud.projects_map.get("")
        assert (
            personal_space is not None
        ), "Expected the 'Personal' space to be added to the map."
        assert (
            personal_space.name == "Personal"
        ), "The 'Personal' space name is incorrect."
        assert (
            personal_space.id == ""
        ), "The 'Personal' space id should be empty string."
        assert (
            personal_space.type == QlikSpaceType.PERSONAL
        ), "The 'Personal' space type is incorrect."

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

    @pytest.mark.order(5)
    def test_managed_app_dashboard(self):
        with patch.object(
            QlikCloudClient, "get_projects_list", return_value=MOCK_PROJECTS
        ):
            self.qlikcloud.prepare()

        managed_app_dashboards_count = 0
        self.qlikcloud.service_connection.spaceTypes = [
            SpaceType.Shared,
            SpaceType.Personal,
        ]
        for dashboard in MOCK_DASHBOARDS:
            space = self.qlikcloud.projects_map[dashboard.space_id]
            if self.qlikcloud.filter_projects_by_type(space):
                managed_app_dashboards_count += 1
        assert managed_app_dashboards_count == MANAGED_APP_DASHBOARD_IN_MOCK_DASHBOARDS

    @pytest.mark.order(6)
    def test_shared_app_dashboard(self):
        with patch.object(
            QlikCloudClient, "get_projects_list", return_value=MOCK_PROJECTS
        ):
            self.qlikcloud.prepare()

        shared_app_dashboards_count = 0
        self.qlikcloud.service_connection.spaceTypes = [
            SpaceType.Managed,
            SpaceType.Personal,
        ]
        for dashboard in MOCK_DASHBOARDS:
            space = self.qlikcloud.projects_map[dashboard.space_id]
            if self.qlikcloud.filter_projects_by_type(space):
                shared_app_dashboards_count += 1
        assert shared_app_dashboards_count == SHARED_APP_DASHBOARD_IN_MOCK_DASHBOARDS

    @pytest.mark.order(7)
    def test_personal_app_dashboard(self):
        with patch.object(
            QlikCloudClient, "get_projects_list", return_value=MOCK_PROJECTS
        ):
            self.qlikcloud.prepare()

        personal_app_dashboards_count = 0
        self.qlikcloud.service_connection.spaceTypes = [
            SpaceType.Managed,
            SpaceType.Shared,
        ]
        for dashboard in MOCK_DASHBOARDS:
            space = self.qlikcloud.projects_map[dashboard.space_id]
            if self.qlikcloud.filter_projects_by_type(space):
                personal_app_dashboards_count += 1
        assert (
            personal_app_dashboards_count == PERSONAL_APP_DASHBOARD_IN_MOCK_DASHBOARDS
        )

    @pytest.mark.order(8)
    def test_space_type_filter_dashboard(self):
        with patch.object(
            QlikCloudClient, "get_projects_list", return_value=MOCK_PROJECTS
        ):
            self.qlikcloud.prepare()

        space_type_filtered_dashboards_count = 0
        self.qlikcloud.service_connection.spaceTypes = [SpaceType.Personal]
        for dashboard in MOCK_DASHBOARDS:
            space = self.qlikcloud.projects_map[dashboard.space_id]
            if self.qlikcloud.filter_projects_by_type(space):
                space_type_filtered_dashboards_count += 1
        assert (
            space_type_filtered_dashboards_count
            == MANAGED_APP_DASHBOARD_IN_MOCK_DASHBOARDS
            + SHARED_APP_DASHBOARD_IN_MOCK_DASHBOARDS
        )

        space_type_filtered_dashboards_count = 0
        self.qlikcloud.service_connection.spaceTypes = [SpaceType.Shared]
        for dashboard in MOCK_DASHBOARDS:
            space = self.qlikcloud.projects_map[dashboard.space_id]
            if self.qlikcloud.filter_projects_by_type(space):
                space_type_filtered_dashboards_count += 1
        assert (
            space_type_filtered_dashboards_count
            == MANAGED_APP_DASHBOARD_IN_MOCK_DASHBOARDS
            + PERSONAL_APP_DASHBOARD_IN_MOCK_DASHBOARDS
        )

        space_type_filtered_dashboards_count = 0
        self.qlikcloud.service_connection.spaceTypes = [SpaceType.Managed]
        for dashboard in MOCK_DASHBOARDS:
            space = self.qlikcloud.projects_map[dashboard.space_id]
            if self.qlikcloud.filter_projects_by_type(space):
                space_type_filtered_dashboards_count += 1
        assert (
            space_type_filtered_dashboards_count
            == SHARED_APP_DASHBOARD_IN_MOCK_DASHBOARDS
            + PERSONAL_APP_DASHBOARD_IN_MOCK_DASHBOARDS
        )

    @pytest.mark.order(9)
    def test_get_script_tables(self):
        """Test the get_script_tables method that extracts table names from Qlik scripts"""
        # Mock script content with FROM clauses
        mock_script = """
        LOAD * FROM 'mock_schema.sales_data';
        LOAD column1, column2 FROM database.schema.customers;
        LEFT JOIN products ON sales_data.product_id = products.id;
        """

        mock_script_response = {"result": {"qScript": mock_script}}

        with patch.object(
            QlikCloudClient,
            "_websocket_send_request",
            return_value=mock_script_response,
        ):
            script_tables = self.qlikcloud.client.get_script_tables()

            # Expected table names extracted from the script
            expected_table_names = ["sales_data", "customers"]

            # Verify that we got the expected number of tables
            assert len(script_tables) == len(
                expected_table_names
            ), f"Expected {len(expected_table_names)} tables, but got {len(script_tables)}"

            # Verify table names are correctly extracted
            actual_table_names = [table.tableName for table in script_tables]
            for expected_name in expected_table_names:
                assert (
                    expected_name in actual_table_names
                ), f"Expected table '{expected_name}' not found in {actual_table_names}"

    @pytest.mark.order(10)
    def test_get_script_tables_empty(self):
        """Test the get_script_tables method with empty script"""
        mock_script_response = {"result": {"qScript": ""}}

        with patch.object(
            QlikCloudClient,
            "_websocket_send_request",
            return_value=mock_script_response,
        ):
            script_tables = self.qlikcloud.client.get_script_tables()

            # Should return empty list for empty script
            assert (
                len(script_tables) == 0
            ), f"Expected 0 tables for empty script, but got {len(script_tables)}"
