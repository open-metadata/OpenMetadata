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

import requests
from testcontainers.general import DockerContainer
from testcontainers.postgres import PostgresContainer

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboard import DashboardType
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
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.mixins.server_mixin import OMetaServerMixin
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.superset.api_source import SupersetAPISource
from metadata.ingestion.source.dashboard.superset.client import SupersetAPIClient
from metadata.ingestion.source.dashboard.superset.db_source import SupersetDBSource
from metadata.ingestion.source.dashboard.superset.metadata import SupersetSource
from metadata.ingestion.source.dashboard.superset.models import (
    FetchChart,
    FetchDashboard,
    ListDatabaseResult,
    SupersetChart,
    SupersetDashboardCount,
    SupersetDatasource,
)

# postgres test container
postgres = PostgresContainer("postgres:16-alpine")
postgres.start()

# superset testcontainer
superset_container = DockerContainer(image="apache/superset")
superset_container.with_env("SUPERSET_SECRET_KEY", "&3brfbcf192T!)$sabqbie")
superset_container.with_env("WTF_CSRF_ENABLED", False)

superset_container.with_exposed_ports(8088)
superset_container.start()

superset_container.exec(
    "superset fab create-admin --username admin --firstname Superset  --lastname Admin --email admin@superset.com --password admin"
)
superset_container.exec("superset db upgrade")
superset_container.exec("superset init")
superset_container.exec("superset load-examples")

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/superset_dataset.json"
)
with open(mock_file_path, encoding="UTF-8") as file:
    mock_data: dict = json.load(file)

MOCK_DASHBOARD_RESP = SupersetDashboardCount(**mock_data["dashboard"])
MOCK_DASHBOARD = MOCK_DASHBOARD_RESP.result[0]
PUBLISHED_DASHBOARD_COUNT = 9
PUBLISHED_DASHBOARD_NAME = "Unicode Test"
MOCK_CHART_RESP = SupersetChart(**mock_data["chart"])
MOCK_CHART = MOCK_CHART_RESP.result[0]

MOCK_CHART_DB = FetchChart(**mock_data["chart-db"][0])
MOCK_CHART_DB_2 = FetchChart(**mock_data["chart-db"][1])
MOCK_DASHBOARD_DB = FetchDashboard(**mock_data["dashboard-db"])

MOCK_SUPERSET_API_CONFIG = {
    "source": {
        "type": "superset",
        "serviceName": "test_supserset",
        "serviceConnection": {
            "config": {
                "hostPort": f"http://{superset_container.get_container_host_ip()}:{superset_container.get_exposed_port(8088)}",
                "type": "Superset",
                "connection": {
                    "username": "admin",
                    "password": "admin",
                    "provider": "db",
                },
            }
        },
        "sourceConfig": {
            "config": {"type": "DashboardMetadata", "includeDraftDashboard": False}
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
                    "hostPort": f"{postgres.get_container_host_ip()}:{postgres.get_exposed_port(5432)}",
                    "username": postgres.POSTGRES_USER,
                    "authType": {"password": postgres.POSTGRES_PASSWORD},
                    "database": postgres.POSTGRES_DB,
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
MOCK_DASHBOARD_INPUT = {
    "certification_details": "sample certificate details",
    "certified_by": "certified by unknown",
    "css": "css",
    "dashboard_title": "Top trades",
    "external_url": "external url",
    "slug": "top-trades",
    "published": True,
    "position_json": '{"CHART-dwSXo_0t5X":{"children":[],"id":"CHART-dwSXo_0t5X","meta":{"chartId":37,"height":50,"sliceName":"% Rural","uuid":"8f663401-854a-4da7-8e50-4b8e4ebb4f22","width":4},"parents":["ROOT_ID","GRID_ID","ROW-z_7odBWenK"],"type":"CHART"},"DASHBOARD_VERSION_KEY":"v2","GRID_ID":{"children":["ROW-z_7odBWenK"],"id":"GRID_ID","parents":["ROOT_ID"],"type":"GRID"},"HEADER_ID":{"id":"HEADER_ID","meta":{"text":"My DASH"},"type":"HEADER"},"ROOT_ID":{"children":["GRID_ID"],"id":"ROOT_ID","type":"ROOT"},"ROW-z_7odBWenK":{"children":["CHART-dwSXo_0t5X"],"id":"ROW-z_7odBWenK","meta":{"background":"BACKGROUND_TRANSPARENT"},"parents":["ROOT_ID","GRID_ID"],"type":"ROW"}}',
}

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

EXPECTED_CHART_ENTITY = [
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
    sourceUrl="https://my-superset.com/superset/dashboard/14/",
    charts=[chart.fullyQualifiedName for chart in EXPECTED_CHART_ENTITY],
    service=EXPECTED_DASH_SERVICE.fullyQualifiedName,
    owner=EXPECTED_USER,
)


EXPECTED_API_DASHBOARD = CreateDashboardRequest(
    name=EntityName(__root__="10"),
    displayName="Unicode Test",
    description=None,
    dashboardType=DashboardType.Dashboard.value,
    sourceUrl=SourceUrl(
        __root__="http://localhost:54510/superset/dashboard/unicode-test/"
    ),
    project=None,
    charts=[],
    dataModels=None,
    tags=None,
    owner=None,
    service=FullyQualifiedEntityName(__root__="test_supserset"),
    extension=None,
    domain=None,
    dataProducts=None,
    lifeCycle=None,
    sourceHash=None,
)

EXPECTED_CHART = CreateChartRequest(
    name=1,
    displayName="Rural",
    description="desc",
    chartType=ChartType.Other.value,
    sourceUrl="https://my-superset.com/explore/?slice_id=1",
    service=EXPECTED_DASH_SERVICE.fullyQualifiedName,
)
EXPECTED_CHART_2 = CreateChartRequest(
    name=EntityName(__root__="69"),
    displayName="Unicode Cloud",
    description=None,
    chartType=ChartType.Other.value,
    sourceUrl=SourceUrl(__root__="http://localhost:54510/explore/?slice_id=69"),
    tags=None,
    owner=None,
    service=FullyQualifiedEntityName(__root__="test_supserset"),
    domain=None,
    dataProducts=None,
    lifeCycle=None,
    sourceHash=None,
)

EXPECTED_ALL_CHARTS = {37: MOCK_CHART}
# EXPECTED_ALL_CHARTS_DB = {37: MOCK_CHART_DB}
EXPECTED_ALL_CHARTS_DB = {1: MOCK_CHART_DB_2}

NOT_FOUND_RESP = {"message": "Not found"}

EXPECTED_DATASET_FQN = "test_postgres.examples.main.wb_health_population"


def perform_sql_queries(superset_db):
    # [(1, 'Rural', 'desc', 99, 'bar_chart', 'sample_table', 'main', 'test_db', 'postgres://user:pass@localhost:5432/examples')]
    CREATE_SLICES_TABLE = """
        CREATE TABLE slices (
            id INTEGER PRIMARY KEY,
            slice_name VARCHAR(255),
            description TEXT,
            datasource_id INTEGER,
            viz_type VARCHAR(255),
            datasource_type VARCHAR(255)
        )
    """
    INSERT_SLICES_DATA = """
        INSERT INTO slices(id, slice_name, description, datasource_id, viz_type, datasource_type)
        VALUES (1, 'Rural', 'desc', 99, 'bar_chart', 'table');
    """
    CREATE_DBS_TABLE = """
        CREATE TABLE dbs (
            id INTEGER PRIMARY KEY,
            database_name VARCHAR(255),
            sqlalchemy_uri TEXT
        )
    """
    INSERT_DBS_DATA = """
        INSERT INTO dbs(id, database_name, sqlalchemy_uri)
        VALUES (5, 'test_db', 'postgres://user:pass@localhost:5432/examples');
    """
    CREATE_TABLES_TABLE = """
        CREATE TABLE tables (
            id INTEGER PRIMARY KEY,
            table_name VARCHAR(255),
            schema VARCHAR(255),
            database_id INTEGER
        );
    """
    INSERT_TABLES_DATA = """
        INSERT INTO tables(id, table_name, schema, database_id)
        VALUES (99, 'sample_table', 'main', 5);
    """
    superset_db.engine.execute(CREATE_SLICES_TABLE)
    superset_db.engine.execute(INSERT_SLICES_DATA)

    superset_db.engine.execute(CREATE_DBS_TABLE)
    superset_db.engine.execute(INSERT_DBS_DATA)

    superset_db.engine.execute(CREATE_TABLES_TABLE)
    superset_db.engine.execute(INSERT_TABLES_DATA)


def create_mock_dashboard_via_api(superset_api):
    session_obj = requests.session()
    hostPort = superset_api.client.config.hostPort
    resp = session_obj.post(
        f"{hostPort}/api/v1/security/login",
        json={
            "username": superset_api.client.config.connection.username,
            "password": superset_api.client.config.connection.password.get_secret_value(),
            "provider": superset_api.client.config.connection.provider.value,
        },
    )
    access_token = resp.json()["access_token"]

    headers = {"Authorization": f"Bearer {access_token}"}
    csrf_resp = session_obj.get(
        f"{hostPort}/api/v1/security/csrf_token", headers=headers
    )
    csrf_token = csrf_resp.json()["result"]
    csrf_header = {"X-CSRF-Token": csrf_token}
    headers.update(csrf_header)
    session_obj.headers.update(headers)
    resp = session_obj.post(f"{hostPort}/api/v1/dashboard", json=MOCK_DASHBOARD_INPUT)


class SupersetUnitTest(TestCase):
    """
    Validate how we work with Superset metadata
    """

    def __init__(self, methodName) -> None:
        super().__init__(methodName)
        self.config = OpenMetadataWorkflowConfig.parse_obj(MOCK_SUPERSET_API_CONFIG)

        # with patch.object(
        #     DashboardServiceSource, "test_connection", return_value=False
        # ), patch.object(OMetaServerMixin, "validate_versions", return_value=True):
        # This already validates that the source can be initialized
        self.superset_api: SupersetSource = SupersetSource.create(
            MOCK_SUPERSET_API_CONFIG["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.assertEqual(type(self.superset_api), SupersetAPISource)
        self.superset_api.context.get().__dict__[
            "dashboard_service"
        ] = EXPECTED_DASH_SERVICE.fullyQualifiedName.__root__

        # with patch.object(
        #     SupersetAPIClient, "fetch_total_charts", return_value=1
        # ), patch.object(
        #     SupersetAPIClient, "fetch_charts", return_value=MOCK_CHART_RESP
        # ):
        #     self.superset_api.prepare()
        #     self.assertEqual(EXPECTED_ALL_CHARTS, self.superset_api.all_charts)

        with patch.object(
            DashboardServiceSource, "test_connection", return_value=False
        ), patch.object(OMetaServerMixin, "validate_versions", return_value=True):
            # This already validates that the source can be initialized
            self.superset_db: SupersetSource = SupersetSource.create(
                MOCK_SUPERSET_DB_CONFIG["source"],
                OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
            )

            self.assertEqual(type(self.superset_db), SupersetDBSource)
            self.superset_db.context.get().__dict__[
                "dashboard_service"
            ] = EXPECTED_DASH_SERVICE.fullyQualifiedName.__root__

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

    def test_api_get_dashboards_list(self):
        """
        Mock the client and check that we get a list
        """
        # create_mock_dashboard_via_api(self.superset_api)
        dashboard_list = self.superset_api.get_dashboards_list()
        self.assertEqual(list(dashboard_list)[0], MOCK_DASHBOARD)

    def test_api_get_published_dashboards_list(self):
        """
        Mock the client and check that we get only published dashboards list
        """
        dashboard_list = list(self.superset_api.get_dashboards_list())
        self.assertEqual(len(dashboard_list), PUBLISHED_DASHBOARD_COUNT)
        self.assertEqual(dashboard_list[0].dashboard_title, PUBLISHED_DASHBOARD_NAME)

    def test_charts_of_dashboard(self):
        """
        Mock the client and check that we get a list
        """
        result = self.superset_api._get_charts_of_dashboard(  # pylint: disable=protected-access
            MOCK_DASHBOARD
        )
        self.assertEqual(result, [69])

    def test_fetch_chart_db(self):
        """
        test fetch chart method of db source
        """
        perform_sql_queries(self.superset_db)
        self.superset_db.prepare()
        self.assertEqual(EXPECTED_ALL_CHARTS_DB, self.superset_db.all_charts)

    def test_dashboard_name(self):
        dashboard_name = self.superset_api.get_dashboard_name(MOCK_DASHBOARD)
        self.assertEqual(dashboard_name, MOCK_DASHBOARD.dashboard_title)

    def test_yield_dashboard(self):
        # TEST API SOURCE
        dashboard = next(self.superset_api.yield_dashboard(MOCK_DASHBOARD)).right
        EXPECTED_API_DASHBOARD.sourceUrl = SourceUrl(
            __root__=f"http://{superset_container.get_container_host_ip()}:{superset_container.get_exposed_port(8088)}{MOCK_DASHBOARD.url}"
        )
        self.assertEqual(dashboard, EXPECTED_API_DASHBOARD)

        # TEST DB SOURCE
        with patch.object(
            SupersetDBSource, "_get_user_by_email", return_value=EXPECTED_USER
        ):
            self.superset_db.context.get().__dict__["charts"] = [
                chart.name.__root__ for chart in EXPECTED_CHART_ENTITY
            ]
            dashboard = next(self.superset_db.yield_dashboard(MOCK_DASHBOARD_DB)).right
            self.assertEqual(dashboard, EXPECTED_DASH)

    def test_yield_dashboard_chart(self):
        # TEST API SOURCE
        self.superset_api.prepare()
        dashboard_charts = next(
            self.superset_api.yield_dashboard_chart(MOCK_DASHBOARD)
        ).right
        EXPECTED_CHART_2.sourceUrl = SourceUrl(
            __root__=f"http://{superset_container.get_container_host_ip()}:{superset_container.get_exposed_port(8088)}/explore/?slice_id=69"
        )
        self.assertEqual(dashboard_charts, EXPECTED_CHART_2)

        # TEST DB SOURCE
        self.superset_db.prepare()
        try:
            dashboard_charts = next(
                self.superset_db.yield_dashboard_chart(MOCK_DASHBOARD_DB)
            ).right
        except StopIteration:
            self.assertEqual(dashboard_charts, EXPECTED_CHART)

    def test_api_get_datasource_fqn(self):
        """
        Test generated datasource fqn for api source
        """
        with patch.object(
            OpenMetadata, "es_search_from_fqn", return_value=None
        ), patch.object(
            SupersetAPIClient,
            "fetch_datasource",
            return_value=SupersetDatasource(**mock_data["datasource"]),
        ), patch.object(
            SupersetAPIClient,
            "fetch_database",
            return_value=ListDatabaseResult(**mock_data["database"]),
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
            return_value=SupersetDatasource(**mock_data["datasource"]),
        ), patch.object(
            SupersetAPIClient, "fetch_database", return_value=ListDatabaseResult()
        ):
            fqn = self.superset_api._get_datasource_fqn(  # pylint: disable=protected-access
                1, MOCK_DB_POSTGRES_SERVICE
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
        # stop both testcontainers after all tests performed
        # postgres.stop()
        # superset_container.stop()
