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

from copy import deepcopy
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
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
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.metabase import metadata as MetabaseMetadata
from metadata.ingestion.source.dashboard.metabase.metadata import MetabaseSource
from metadata.ingestion.source.dashboard.metabase.models import (
    DashCard,
    DatasetQuery,
    MetabaseChart,
    MetabaseDashboardDetails,
    MetabaseTable,
    Native,
)
from metadata.utils import fqn

MOCK_DASHBOARD_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="mock_metabase"),
    name="mock_metabase",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Metabase,
)

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="mock_mysql"),
    name="mock_mysql",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Mysql,
)

Mock_DATABASE_SCHEMA = "my_schema"

Mock_DATABASE_SCHEMA_DEFAULT = "<default>"

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
    DashCard(
        card=MetabaseChart(
            description="Test Chart",
            table_id=1,
            database_id=1,
            name="chart1",
            id="1",
            dataset_query=DatasetQuery(type="query"),
            display="chart1",
        )
    ),
    DashCard(
        card=MetabaseChart(
            description="Test Chart",
            table_id=1,
            database_id=1,
            name="chart2",
            id="2",
            dataset_query=DatasetQuery(
                type="native", native=Native(query="select * from test_table")
            ),
            display="chart2",
        )
    ),
    DashCard(card=MetabaseChart(name="chart3", id="3")),
]


EXPECTED_LINEAGE = AddLineageRequest(
    edge=EntitiesEdge(
        fromEntity=EntityReference(
            id="0bd6bd6f-7fea-4a98-98c7-3b37073629c7",
            type="table",
        ),
        toEntity=EntityReference(
            id="7b3766b1-7eb4-4ad4-b7c8-15a8b16edfdd",
            type="dashboard",
        ),
        lineageDetails=LineageDetails(source=LineageSource.DashboardLineage),
    )
)

MOCK_DASHBOARD_DETAILS = MetabaseDashboardDetails(
    description="SAMPLE DESCRIPTION", name="test_db", id="1", dashcards=MOCK_CHARTS
)


EXPECTED_DASHBOARD = [
    CreateDashboardRequest(
        name="1",
        displayName="test_db",
        description="SAMPLE DESCRIPTION",
        sourceUrl="http://metabase.com/dashboard/1-test-db",
        charts=[],
        service=FullyQualifiedEntityName(__root__="mock_metabase"),
        project="Test Collection",
    )
]

EXPECTED_CHARTS = [
    CreateChartRequest(
        name="1",
        displayName="chart1",
        description="Test Chart",
        chartType="Other",
        sourceUrl="http://metabase.com/question/1-chart1",
        tags=None,
        owner=None,
        service=FullyQualifiedEntityName(__root__="mock_metabase"),
    ),
    CreateChartRequest(
        name="2",
        displayName="chart2",
        description="Test Chart",
        chartType="Other",
        sourceUrl="http://metabase.com/question/2-chart2",
        tags=None,
        owner=None,
        service=FullyQualifiedEntityName(__root__="mock_metabase"),
    ),
    CreateChartRequest(
        name="3",
        displayName="chart3",
        description=None,
        chartType="Other",
        sourceUrl="http://metabase.com/question/3-chart3",
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
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_config)
        self.metabase = MetabaseSource.create(
            mock_config["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.metabase.client = SimpleNamespace()
        self.metabase.context.__dict__[
            "dashboard_service"
        ] = MOCK_DASHBOARD_SERVICE.fullyQualifiedName.__root__
        self.metabase.context.__dict__["project_name"] = "Test Collection"

    def test_dashboard_name(self):
        assert (
            self.metabase.get_dashboard_name(MOCK_DASHBOARD_DETAILS)
            == MOCK_DASHBOARD_DETAILS.name
        )

    def test_check_database_schema_name(self):
        self.assertEqual(
            self.metabase.check_database_schema_name(Mock_DATABASE_SCHEMA), "my_schema"
        )
        self.assertIsNone(
            self.metabase.check_database_schema_name(Mock_DATABASE_SCHEMA_DEFAULT)
        )

    def test_yield_chart(self):
        """
        Function for testing charts
        """
        chart_list = []
        results = self.metabase.yield_dashboard_chart(MOCK_DASHBOARD_DETAILS)
        for result in results:
            if isinstance(result, Either) and result.right:
                chart_list.append(result.right)

        for expected, original in zip(EXPECTED_CHARTS, chart_list):
            self.assertEqual(expected, original)

    def test_yield_dashboard(self):
        """
        Function for testing charts
        """
        results = list(self.metabase.yield_dashboard(MOCK_DASHBOARD_DETAILS))
        self.assertEqual(EXPECTED_DASHBOARD, [res.right for res in results])

    @patch.object(fqn, "build", return_value=None)
    @patch.object(OpenMetadata, "get_by_name", return_value=EXAMPLE_DASHBOARD)
    @patch.object(MetabaseMetadata, "search_table_entities", return_value=EXAMPLE_TABLE)
    @patch.object(
        MetabaseSource, "_get_database_service", return_value=MOCK_DATABASE_SERVICE
    )
    def test_yield_lineage(self, *_):
        """
        Function to test out lineage
        """
        self.metabase.client.get_database = lambda *_: None
        self.metabase.client.get_table = lambda *_: MetabaseTable(
            schema="test_schema", display_name="test_table"
        )

        # if no db service name then no lineage generated
        result = self.metabase.yield_dashboard_lineage_details(
            dashboard_details=MOCK_DASHBOARD_DETAILS, db_service_name=None
        )
        self.assertEqual(list(result), [])

        # test out _yield_lineage_from_api
        mock_dashboard = deepcopy(MOCK_DASHBOARD_DETAILS)
        mock_dashboard.dashcards = [MOCK_DASHBOARD_DETAILS.dashcards[0]]
        result = self.metabase.yield_dashboard_lineage_details(
            dashboard_details=mock_dashboard, db_service_name="db.service.name"
        )
        self.assertEqual(next(result).right, EXPECTED_LINEAGE)

        # test out _yield_lineage_from_query
        mock_dashboard.dashcards = [MOCK_DASHBOARD_DETAILS.dashcards[1]]
        result = self.metabase.yield_dashboard_lineage_details(
            dashboard_details=mock_dashboard, db_service_name="db.service.name"
        )
        self.assertEqual(next(result).right, EXPECTED_LINEAGE)

        # test out if no query type
        mock_dashboard.dashcards = [MOCK_DASHBOARD_DETAILS.dashcards[2]]
        result = self.metabase.yield_dashboard_lineage_details(
            dashboard_details=mock_dashboard, db_service_name="db.service.name"
        )
        self.assertEqual(list(result), [])
