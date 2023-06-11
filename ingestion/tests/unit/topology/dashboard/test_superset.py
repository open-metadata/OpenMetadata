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
Test superset source
"""

import json
import uuid
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy.engine import Engine

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.ometa.mixins.server_mixin import OMetaServerMixin
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.superset.api_source import SupersetAPISource
from metadata.ingestion.source.dashboard.superset.client import SupersetAPIClient
from metadata.ingestion.source.dashboard.superset.db_source import SupersetDBSource
from metadata.ingestion.source.dashboard.superset.metadata import SupersetSource

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/superset_dataset.json"
)
with open(mock_file_path, encoding="UTF-8") as file:
    mock_data: dict = json.load(file)

MOCK_DASHBOARD_RESP = mock_data["dashboard"]
MOCK_DASHBOARD = MOCK_DASHBOARD_RESP["result"][0]
MOCK_CHART_RESP = mock_data["chart"]
MOCK_CHART = MOCK_CHART_RESP["result"][0]

MOCK_CHART_DB = mock_data["chart-db"][0]
MOCK_DASHBOARD_DB = mock_data["dashboard-db"]

MOCK_SUPERSET_API_CONFIG = {
    "source": {
        "type": "superset",
        "serviceName": "test_supserset",
        "serviceConnection": {
            "config": {
                "hostPort": "https://my-superset.com",
                "type": "Superset",
                "connection": {
                    "username": "admin",
                    "password": "admin",
                    "provider": "db",
                },
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DashboardMetadata",
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        },
    },
}


MOCK_SUPERSET_DB_CONFIG = {
    "source": {
        "type": "superset",
        "serviceName": "test_supserset",
        "serviceConnection": {
            "config": {
                "hostPort": "https://my-superset.com",
                "type": "Superset",
                "connection": {
                    "type": "Postgres",
                    "username": "superset",
                    "authType": {
                        "password": "superset",
                    },
                    "hostPort": "localhost:5432",
                    "database": "superset",
                },
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DashboardMetadata",
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        },
    },
}

EXPECTED_DASH_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="test_supserset"),
    name="test_supserset",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Superset,
)
EXPECTED_USER = EntityReference(id=uuid.uuid4(), type="user")

MOCK_DB_MYSQL_SERVICE_1 = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a307122",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="test_mysql"),
    name="test_mysql",
    connection=DatabaseConnection(
        config=MysqlConnection(
            username="user",
            authType=BasicAuth(password="pass"),
            hostPort="localhost:3306",
        )
    ),
    serviceType=DatabaseServiceType.Mysql,
)

MOCK_DB_MYSQL_SERVICE_2 = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a307122",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="test_mysql"),
    name="test_mysql",
    connection=DatabaseConnection(
        config=MysqlConnection(
            username="user",
            authType=BasicAuth(password="pass"),
            hostPort="localhost:3306",
            databaseName="DUMMY_DB",
        )
    ),
    serviceType=DatabaseServiceType.Mysql,
)

MOCK_DB_POSTGRES_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a307122",
    fullyQualifiedName=FullyQualifiedEntityName(__root__="test_postgres"),
    name="test_postgres",
    connection=DatabaseConnection(
        config=PostgresConnection(
            username="user",
            authType=BasicAuth(password="pass"),
            hostPort="localhost:5432",
            database="postgres",
        )
    ),
    serviceType=DatabaseServiceType.Postgres,
)

EXPECTED_CHATRT_ENTITY = [
    Chart(
        id=uuid.uuid4(),
        name=37,
        fullyQualifiedName=FullyQualifiedEntityName(__root__="test_supserset.37"),
        service=EntityReference(
            id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="dashboardService"
        ),
    )
]

EXPECTED_DASH = CreateDashboardRequest(
    name=14,
    displayName="My DASH",
    description="",
    dashboardUrl="https://my-superset.com/superset/dashboard/14/",
    charts=[chart.fullyQualifiedName for chart in EXPECTED_CHATRT_ENTITY],
    service=EXPECTED_DASH_SERVICE.fullyQualifiedName,
)

EXPECTED_CHART = CreateChartRequest(
    name=37,
    displayName="% Rural",
    description="TEST DESCRIPTION",
    chartType=ChartType.Other.value,
    chartUrl="https://my-superset.com/explore/?slice_id=37",
    service=EXPECTED_DASH_SERVICE.fullyQualifiedName,
)

EXPECTED_ALL_CHARTS = {37: MOCK_CHART}
EXPECTED_ALL_CHARTS_DB = {37: MOCK_CHART_DB}

NOT_FOUND_RESP = {"message": "Not found"}

EXPECTED_DATASET_FQN = "test_postgres.examples.main.wb_health_population"


class SupersetUnitTest(TestCase):
    """
    Validate how we work with Superset metadata
    """

    def __init__(self, methodName) -> None:
        super().__init__(methodName)
        self.config = OpenMetadataWorkflowConfig.parse_obj(MOCK_SUPERSET_API_CONFIG)

        with patch.object(
            DashboardServiceSource, "test_connection", return_value=False
        ), patch.object(OMetaServerMixin, "validate_versions", return_value=True):
            # This already validates that the source can be initialized
            self.superset_api: SupersetSource = SupersetSource.create(
                MOCK_SUPERSET_API_CONFIG["source"],
                self.config.workflowConfig.openMetadataServerConfig,
            )

            self.assertEqual(type(self.superset_api), SupersetAPISource)

            self.superset_api.context.__dict__[
                "dashboard_service"
            ] = EXPECTED_DASH_SERVICE

            with patch.object(
                SupersetAPIClient, "fetch_total_charts", return_value=1
            ), patch.object(
                SupersetAPIClient, "fetch_charts", return_value=MOCK_CHART_RESP
            ):
                self.superset_api.prepare()
                self.assertEqual(EXPECTED_ALL_CHARTS, self.superset_api.all_charts)

        with patch.object(
            DashboardServiceSource, "test_connection", return_value=False
        ), patch.object(OMetaServerMixin, "validate_versions", return_value=True):
            # This already validates that the source can be initialized
            self.superset_db: SupersetSource = SupersetSource.create(
                MOCK_SUPERSET_DB_CONFIG["source"],
                self.config.workflowConfig.openMetadataServerConfig,
            )

            self.assertEqual(type(self.superset_db), SupersetDBSource)

            self.superset_db.context.__dict__[
                "dashboard_service"
            ] = EXPECTED_DASH_SERVICE

            with patch.object(Engine, "execute", return_value=mock_data["chart-db"]):
                self.superset_db.prepare()
                self.assertEqual(EXPECTED_ALL_CHARTS_DB, self.superset_db.all_charts)

    def test_create(self):
        """
        An invalid config raises an error
        """
        not_superset_source = {
            "type": "mysql",
            "serviceName": "mysql_local",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "authType": {
                        "password": "openmetadata_password",
                    },
                    "hostPort": "localhost:3306",
                    "databaseSchema": "openmetadata_db",
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                }
            },
        }

        self.assertRaises(
            InvalidSourceException,
            SupersetSource.create,
            not_superset_source,
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_api_perpare(self):
        pass

    def test_api_get_dashboards_list(self):
        """
        Mock the client and check that we get a list
        """

        with patch.object(
            SupersetAPIClient, "fetch_total_dashboards", return_value=1
        ), patch.object(
            SupersetAPIClient, "fetch_dashboards", return_value=MOCK_DASHBOARD_RESP
        ):
            dashboard_list = self.superset_api.get_dashboards_list()
            self.assertEqual(list(dashboard_list), [MOCK_DASHBOARD])

    def test_charts_of_dashboard(self):
        """
        Mock the client and check that we get a list
        """
        result = self.superset_api._get_charts_of_dashboard(  # pylint: disable=protected-access
            MOCK_DASHBOARD
        )
        self.assertEqual(result, [37])

    def test_dashboard_name(self):
        dashboard_name = self.superset_api.get_dashboard_name(MOCK_DASHBOARD)
        self.assertEqual(dashboard_name, MOCK_DASHBOARD["dashboard_title"])

    def test_yield_dashboard(self):
        # TEST API SOURCE
        with patch.object(
            SupersetAPISource, "_get_user_by_email", return_value=EXPECTED_USER
        ):
            self.superset_api.context.__dict__["charts"] = EXPECTED_CHATRT_ENTITY
            dashboard = self.superset_api.yield_dashboard(MOCK_DASHBOARD)
            self.assertEqual(list(dashboard), [EXPECTED_DASH])

        # TEST DB SOURCE
        with patch.object(
            SupersetDBSource, "_get_user_by_email", return_value=EXPECTED_USER
        ):
            self.superset_db.context.__dict__["charts"] = EXPECTED_CHATRT_ENTITY
            dashboard = self.superset_db.yield_dashboard(MOCK_DASHBOARD_DB)
            self.assertEqual(list(dashboard), [EXPECTED_DASH])

    def test_yield_dashboard_chart(self):
        # TEST API SOURCE
        dashboard_charts = self.superset_api.yield_dashboard_chart(MOCK_DASHBOARD)
        self.assertEqual(list(dashboard_charts), [EXPECTED_CHART])

        # TEST DB SOURCE
        dashboard_charts = self.superset_db.yield_dashboard_chart(MOCK_DASHBOARD_DB)
        self.assertEqual(list(dashboard_charts), [EXPECTED_CHART])

    def test_api_get_datasource_fqn(self):
        """
        Test generated datasource fqn for api source
        """
        with patch.object(
            OpenMetadata, "es_search_from_fqn", return_value=None
        ), patch.object(
            SupersetAPIClient,
            "fetch_datasource",
            return_value=mock_data.get("datasource"),
        ), patch.object(
            SupersetAPIClient, "fetch_database", return_value=mock_data.get("database")
        ):
            fqn = self.superset_api._get_datasource_fqn(  # pylint: disable=protected-access
                1, MOCK_DB_POSTGRES_SERVICE
            )
            self.assertEqual(fqn, EXPECTED_DATASET_FQN)

        with patch.object(
            OpenMetadata, "es_search_from_fqn", return_value=None
        ), patch.object(
            SupersetAPIClient,
            "fetch_datasource",
            return_value=mock_data.get("datasource"),
        ), patch.object(
            SupersetAPIClient, "fetch_database", return_value=NOT_FOUND_RESP
        ):
            fqn = self.superset_api._get_datasource_fqn(  # pylint: disable=protected-access
                1, "demo"
            )
            self.assertEqual(fqn, None)

    def test_db_get_datasource_fqn_for_lineage(self):
        fqn = self.superset_db._get_datasource_fqn_for_lineage(  # pylint: disable=protected-access
            MOCK_CHART_DB, MOCK_DB_POSTGRES_SERVICE
        )
        self.assertEqual(fqn, EXPECTED_DATASET_FQN)

    def test_db_get_database_name(self):
        sqa_str1 = "postgres://user:pass@localhost:8888/database"
        self.assertEqual(
            self.superset_db._get_database_name(  # pylint: disable=protected-access
                sqa_str1, MOCK_DB_POSTGRES_SERVICE
            ),
            "database",
        )

        sqa_str2 = "postgres://user:pass@localhost:8888/database?ssl=required"
        self.assertEqual(
            self.superset_db._get_database_name(  # pylint: disable=protected-access
                sqa_str2, MOCK_DB_POSTGRES_SERVICE
            ),
            "database",
        )

        sqa_str3 = "postgres://user:pass@localhost:8888/openmetadata_db"
        self.assertEqual(
            self.superset_db._get_database_name(  # pylint: disable=protected-access
                sqa_str3, MOCK_DB_MYSQL_SERVICE_1
            ),
            "default",
        )

        sqa_str4 = "postgres://user:pass@localhost:8888/openmetadata_db"
        self.assertEqual(
            self.superset_db._get_database_name(  # pylint: disable=protected-access
                sqa_str4, MOCK_DB_MYSQL_SERVICE_2
            ),
            "DUMMY_DB",
        )

        sqa_str2 = "sqlite:////app/superset_home/superset.db"
        self.assertEqual(
            self.superset_db._get_database_name(  # pylint: disable=protected-access
                sqa_str2, MOCK_DB_POSTGRES_SERVICE
            ),
            "/app/superset_home/superset.db",
        )
