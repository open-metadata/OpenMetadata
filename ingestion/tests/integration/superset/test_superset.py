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
Test superset source
"""

import json
import uuid
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

import sqlalchemy
from collate_sqllineage.core.models import Column, Schema, SubQuery, Table
from testcontainers.core.generic import DockerContainer
from testcontainers.postgres import PostgresContainer

from _openmetadata_testutils.postgres.conftest import postgres_container
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
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.superset.api_source import SupersetAPISource
from metadata.ingestion.source.dashboard.superset.db_source import SupersetDBSource
from metadata.ingestion.source.dashboard.superset.metadata import SupersetSource
from metadata.ingestion.source.dashboard.superset.models import (
    FetchChart,
    FetchColumn,
    FetchDashboard,
    SupersetChart,
    SupersetDashboardCount,
)

mock_file_path = Path(__file__).parent / "resources/superset_dataset.json"
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

EXPECTED_DASH_SERVICE = DashboardService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    fullyQualifiedName=FullyQualifiedEntityName("test_supserset"),
    name="test_supserset",
    connection=DashboardConnection(),
    serviceType=DashboardServiceType.Superset,
)
EXPECTED_USER = EntityReferenceList(
    root=[EntityReference(id="81af89aa-1bab-41aa-a567-5e68f78acdc0", type="user")]
)

MOCK_DB_MYSQL_SERVICE_1 = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a307122",
    fullyQualifiedName=FullyQualifiedEntityName("test_mysql"),
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
    fullyQualifiedName=FullyQualifiedEntityName("test_mysql"),
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
    fullyQualifiedName=FullyQualifiedEntityName("test_postgres"),
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
        name="37",
        fullyQualifiedName=FullyQualifiedEntityName("test_supserset.37"),
        service=EntityReference(
            id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="dashboardService"
        ),
    )
]

EXPECTED_DASH = CreateDashboardRequest(
    name="14",
    displayName="My DASH",
    sourceUrl="https://my-superset.com/superset/dashboard/14/",
    charts=[chart.fullyQualifiedName for chart in EXPECTED_CHART_ENTITY],
    service=EXPECTED_DASH_SERVICE.fullyQualifiedName,
    owners=EXPECTED_USER,
)

EXPECTED_API_DASHBOARD = CreateDashboardRequest(
    name=EntityName("10"),
    displayName="Unicode Test",
    description=None,
    dashboardType=DashboardType.Dashboard.value,
    sourceUrl=SourceUrl("http://localhost:54510/superset/dashboard/unicode-test/"),
    project=None,
    charts=[],
    dataModels=None,
    tags=None,
    owners=None,
    service=FullyQualifiedEntityName("test_supserset"),
    extension=None,
    domain=None,
    dataProducts=None,
    lifeCycle=None,
    sourceHash=None,
)

EXPECTED_CHART = CreateChartRequest(
    name="1",
    displayName="Rural",
    description="desc",
    chartType=ChartType.Other.value,
    sourceUrl="https://my-superset.com/explore/?slice_id=1",
    service=EXPECTED_DASH_SERVICE.fullyQualifiedName,
)
EXPECTED_CHART_2 = CreateChartRequest(
    name=EntityName("69"),
    displayName="Unicode Cloud",
    description=None,
    chartType=ChartType.Other.value,
    sourceUrl=SourceUrl("http://localhost:54510/explore/?slice_id=69"),
    tags=None,
    owners=None,
    service=FullyQualifiedEntityName("test_supserset"),
    domain=None,
    dataProducts=None,
    lifeCycle=None,
    sourceHash=None,
)
MOCK_DATASOURCE = [
    FetchColumn(
        id=11, type="INT()", column_name="Population", table_name="sample_table"
    )
]

# EXPECTED_ALL_CHARTS = {37: MOCK_CHART}
# EXPECTED_ALL_CHARTS_DB = {37: MOCK_CHART_DB}
EXPECTED_ALL_CHARTS_DB = {1: MOCK_CHART_DB_2}

NOT_FOUND_RESP = {"message": "Not found"}
EXPECTED_API_DATASET_FQN = "test_postgres.*.main.wb_health_population"
EXPECTED_DATASET_FQN = "test_postgres.examples.main.wb_health_population"


def setup_sample_data(postgres_container):
    engine = sqlalchemy.create_engine(postgres_container.get_connection_url())
    with engine.begin() as connection:
        CREATE_TABLE_AB_USER = """
                CREATE TABLE ab_user (
                id INT PRIMARY KEY,
                username VARCHAR(50));
        """
        CREATE_TABLE_DASHBOARDS = """
            CREATE TABLE dashboards (
            id INT PRIMARY KEY,
            created_by_fk INT,
            FOREIGN KEY (created_by_fk) REFERENCES ab_user(id));
        """
        INSERT_AB_USER_DATA = """
            INSERT INTO ab_user (id, username)
            VALUES (1, 'test_user');
        """
        INSERT_DASHBOARDS_DATA = """
            INSERT INTO dashboards (id, created_by_fk)
            VALUES (1, 1);
        """
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
                database_id INTEGER,
                sql VARCHAR(4000)
            );
        """
        INSERT_TABLES_DATA = """
            INSERT INTO tables(id, table_name, schema, database_id)
            VALUES (99, 'sample_table', 'main', 5);
        """
        CREATE_TABLE_COLUMNS_TABLE = """
            CREATE TABLE table_columns (
                id INTEGER PRIMARY KEY,
                table_name VARCHAR(255),
                table_id INTEGER,
                column_name VARCHAR(255),
                type VARCHAR(255),
                description VARCHAR(255)
            );
        """
        CREATE_TABLE_COLUMNS_DATA = """
            INSERT INTO 
                table_columns(id, table_name, table_id, column_name, type, description)
            VALUES 
                (1099, 'sample_table', 99, 'id', 'VARCHAR', 'dummy description'), 
                (1199, 'sample_table', 99, 'timestamp', 'VARCHAR', 'dummy description'),
                (1299, 'sample_table', 99, 'price', 'VARCHAR', 'dummy description');
        """

        connection.execute(sqlalchemy.text(CREATE_TABLE_AB_USER))
        connection.execute(sqlalchemy.text(INSERT_AB_USER_DATA))
        connection.execute(sqlalchemy.text(CREATE_TABLE_DASHBOARDS))
        connection.execute(sqlalchemy.text(INSERT_DASHBOARDS_DATA))
        connection.execute(sqlalchemy.text(CREATE_SLICES_TABLE))
        connection.execute(sqlalchemy.text(INSERT_SLICES_DATA))
        connection.execute(sqlalchemy.text(CREATE_DBS_TABLE))
        connection.execute(sqlalchemy.text(INSERT_DBS_DATA))
        connection.execute(sqlalchemy.text(CREATE_TABLES_TABLE))
        connection.execute(sqlalchemy.text(INSERT_TABLES_DATA))
        connection.execute(sqlalchemy.text(CREATE_TABLE_COLUMNS_TABLE))
        connection.execute(sqlalchemy.text(CREATE_TABLE_COLUMNS_DATA))


INITIAL_SETUP = True
superset_container = postgres_container = None


def set_testcontainers():
    global INITIAL_SETUP, superset_container, postgres_container
    if INITIAL_SETUP:
        # postgres test container
        postgres_container = PostgresContainer("postgres:16-alpine")
        postgres_container.start()
        setup_sample_data(postgres_container)
        # superset testcontainer
        superset_container = DockerContainer(image="apache/superset:3.1.2")
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
        INITIAL_SETUP = False
    return superset_container, postgres_container


class SupersetUnitTest(TestCase):
    """
    Validate how we work with Superset metadata
    """

    @classmethod
    def teardown_class(cls):
        """Teardown class"""
        # stop containers
        superset_container.stop()
        postgres_container.stop()

    def __init__(self, methodName) -> None:
        super().__init__(methodName)

        superset_container, postgres_container = set_testcontainers()

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
                    "config": {
                        "type": "DashboardMetadata",
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
                },
            },
        }
        MOCK_SUPERSET_DB_CONFIG = {
            "source": {
                "type": "superset",
                "serviceName": "test_supserset",
                "serviceConnection": {
                    "config": {
                        "hostPort": f"http://{superset_container.get_container_host_ip()}:{superset_container.get_exposed_port(8088)}",
                        "type": "Superset",
                        "connection": {
                            "type": "Postgres",
                            "hostPort": f"{postgres_container.get_container_host_ip()}:{postgres_container.get_exposed_port(5432)}",
                            "username": postgres_container.env.get("POSTGRES_USER"),
                            "authType": {
                                "password": postgres_container.env.get(
                                    "POSTGRES_PASSWORD"
                                )
                            },
                            "database": postgres_container.env.get("POSTGRES_DB"),
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
        self.config = OpenMetadataWorkflowConfig.model_validate(
            MOCK_SUPERSET_API_CONFIG
        )

        self.superset_api: SupersetSource = SupersetSource.create(
            MOCK_SUPERSET_API_CONFIG["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.assertEqual(type(self.superset_api), SupersetAPISource)
        self.superset_api.context.get().__dict__[
            "dashboard_service"
        ] = EXPECTED_DASH_SERVICE.fullyQualifiedName.root

        self.superset_db: SupersetSource = SupersetSource.create(
            MOCK_SUPERSET_DB_CONFIG["source"],
            OpenMetadata(self.config.workflowConfig.openMetadataServerConfig),
        )
        self.assertEqual(type(self.superset_db), SupersetDBSource)
        self.superset_db.context.get().__dict__[
            "dashboard_service"
        ] = EXPECTED_DASH_SERVICE.fullyQualifiedName.root

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

    # disabled due to container being flaky
    def x_test_api_get_dashboards_list(self):
        """
        Mock the client and check that we get a list
        """
        dashboard_list = list(self.superset_api.get_dashboards_list())
        self.assertEqual(len(dashboard_list), PUBLISHED_DASHBOARD_COUNT)

    def test_charts_of_dashboard(self):
        """
        Mock the client and check that we get a list
        """
        result = self.superset_api._get_charts_of_dashboard(  # pylint: disable=protected-access
            MOCK_DASHBOARD
        )
        self.assertEqual(result, [69])

    # disabled due to container being flaky
    def x_test_datamodels_of_dashboard(self):
        """
        Mock the client and check that we get a list
        """
        self.superset_api.prepare()
        result = self.superset_api.yield_datamodel(MOCK_DASHBOARD)
        self.assertEqual(len(list(result)), 1)

    def test_datamodels_of_db_dashboard(self):
        """
        Mock the db client and check that we get a list
        """
        self.superset_db.prepare()
        result = self.superset_db.yield_datamodel(MOCK_DASHBOARD_DB)
        self.assertEqual(len(list(result)), 1)

    def test_fetch_chart_db(self):
        """
        test fetch chart method of db source
        """
        self.superset_db.prepare()
        self.assertEqual(EXPECTED_ALL_CHARTS_DB, self.superset_db.all_charts)

    def test_dashboard_name(self):
        dashboard_name = self.superset_api.get_dashboard_name(MOCK_DASHBOARD)
        self.assertEqual(dashboard_name, MOCK_DASHBOARD.dashboard_title)

    def test_yield_dashboard(self):
        # TEST API SOURCE
        dashboard = next(self.superset_api.yield_dashboard(MOCK_DASHBOARD)).right
        EXPECTED_API_DASHBOARD.sourceUrl = SourceUrl(
            f"http://{superset_container.get_container_host_ip()}:{superset_container.get_exposed_port(8088)}{MOCK_DASHBOARD.url}"
        )
        self.assertEqual(dashboard, EXPECTED_API_DASHBOARD)

        # TEST DB SOURCE
        self.superset_db.context.get().__dict__["charts"] = [
            chart.name.root for chart in EXPECTED_CHART_ENTITY
        ]
        dashboard = next(self.superset_db.yield_dashboard(MOCK_DASHBOARD_DB)).right
        EXPECTED_DASH.sourceUrl = SourceUrl(
            f"http://{superset_container.get_container_host_ip()}:{superset_container.get_exposed_port(8088)}/superset/dashboard/14/"
        )
        EXPECTED_DASH.owners = dashboard.owners
        self.assertEqual(dashboard, EXPECTED_DASH)

    # disabled due to container being flaky
    def x_test_yield_dashboard_chart(self):
        # TEST API SOURCE
        self.superset_api.prepare()
        dashboard_chart = next(
            self.superset_api.yield_dashboard_chart(MOCK_DASHBOARD)
        ).right
        EXPECTED_CHART_2.sourceUrl = SourceUrl(
            f"http://{superset_container.get_container_host_ip()}:{superset_container.get_exposed_port(8088)}/explore/?slice_id={dashboard_chart.name.root}"
        )
        EXPECTED_CHART_2.displayName = dashboard_chart.displayName
        EXPECTED_CHART_2.chartType = dashboard_chart.chartType
        EXPECTED_CHART_2.name = dashboard_chart.name
        self.assertEqual(dashboard_chart, EXPECTED_CHART_2)

        # TEST DB SOURCE
        self.superset_db.prepare()
        dashboard_charts = next(
            self.superset_db.yield_dashboard_chart(MOCK_DASHBOARD_DB)
        ).right
        EXPECTED_CHART.sourceUrl = SourceUrl(
            f"http://{superset_container.get_container_host_ip()}:{superset_container.get_exposed_port(8088)}/explore/?slice_id=1"
        )
        self.assertEqual(dashboard_charts, EXPECTED_CHART)

    def test_api_get_datasource_fqn(self):
        with patch.object(
            OpenMetadata, "get_by_name", return_value=MOCK_DB_POSTGRES_SERVICE
        ):
            """
            Test generated datasource fqn for api source
            """
            fqn = self.superset_api._get_datasource_fqn(  # pylint: disable=protected-access
                1, MOCK_DB_POSTGRES_SERVICE.name.root
            )
            self.assertEqual(fqn, EXPECTED_API_DATASET_FQN)

    def test_db_get_datasource_fqn_for_lineage(self):
        with patch.object(
            OpenMetadata, "get_by_name", return_value=MOCK_DB_POSTGRES_SERVICE
        ):
            fqn = self.superset_db._get_datasource_fqn_for_lineage(  # pylint: disable=protected-access
                MOCK_CHART_DB, MOCK_DB_POSTGRES_SERVICE.name.root
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

    def test_broken_column_type_in_datamodel(self):
        """
        Test column parsing with column containing () in datatype
        """
        self.superset_db.prepare()
        parsed_datasource = self.superset_db.get_column_info(MOCK_DATASOURCE)
        assert parsed_datasource[0].dataType.value == "INT"

    def test_is_table_to_table_lineage(self):
        table = Table(name="table_name", schema=Schema(name="schema_name"))

        for test_case in [
            (
                (
                    Column(name="col_name"),
                    Table(name="table_name", schema=Schema(name="schema_name")),
                    Column(name="col_name"),
                    Table(name="dataset_name", schema=Schema(name="schema_name")),
                ),
                True,
            ),
            (
                (
                    Column(name="col_name"),
                    Table(name="table_name", schema=Schema(name=Schema.unknown)),
                    Column(name="col_name"),
                    Table(name="dataset_name", schema=Schema(name="schema_name")),
                ),
                False,
            ),
            (
                (
                    Column(name="col_name"),
                    Table(name="other_table_name", schema=Schema(name="schema_name")),
                    Column(name="col_name"),
                    Table(name="dataset_name", schema=Schema(name="schema_name")),
                ),
                False,
            ),
            (
                (
                    Column(name="col_name"),
                    Table(name="table_name", schema=Schema(name="schema_name")),
                    Column(name="col_name"),
                    SubQuery(
                        subquery="select * from 1",
                        subquery_raw="select * from 1",
                        alias="dummy_subquery",
                    ),
                ),
                False,
            ),
        ]:
            _columns, expected = test_case

            column_from, column_from_parent, column_to, column_to_parent = _columns

            column_from._parent.add(column_from_parent)
            column_to._parent.add(column_to_parent)

            columns = (column_from, column_to)
            self.assertEqual(
                self.superset_db._is_table_to_table_lineage(columns, table), expected
            )

    def test_append_value_to_dict_list(self):
        init_dict = {1: [2]}

        self.superset_db._append_value_to_dict_list(init_dict, 1, 3)
        self.assertListEqual(init_dict[1], [2, 3])

        self.superset_db._append_value_to_dict_list(init_dict, 2, 1)
        self.assertListEqual(init_dict[2], [1])

    def test_get_table_schema(self):
        for test_case in [
            (
                Table(name="test_table", schema=Schema(name=Schema.unknown)),
                FetchChart(schema="chart_table_schema"),
                "chart_table_schema",
            ),
            (
                Table(name="test_table", schema=Schema(name="test_schema")),
                FetchChart(schema="chart_table_schema"),
                "test_schema",
            ),
        ]:
            table, chart, expected = test_case

            self.assertEqual(self.superset_db._get_table_schema(table, chart), expected)

    def test_create_column_lineage_mapping_no_wildcard(self):
        sql = """
        INSERT INTO dummy_table SELECT id, timestamp FROM input_table;
        """

        parser = LineageParser(sql)
        table = Table(name="input_table", schema=Schema(name=Schema.unknown))
        chart = FetchChart(table_name="sample_table", table_schema="main", table_id=99)

        expected = {"id": ["id"], "timestamp": ["timestamp"]}

        self.assertDictEqual(
            self.superset_db._create_column_lineage_mapping(parser, table, chart),
            expected,
        )

    def test_create_column_lineage_mapping_with_wildcard(self):
        sql = """
        INSERT INTO dummy_table SELECT * FROM input_table;
        """

        parser = LineageParser(sql)
        table = Table(name="input_table", schema=Schema(name=Schema.unknown))
        chart = FetchChart(table_name="sample_table", table_schema="main", table_id=99)

        expected = {"id": ["id"], "timestamp": ["timestamp"], "price": ["price"]}

        self.assertDictEqual(
            self.superset_db._create_column_lineage_mapping(parser, table, chart),
            expected,
        )

    def test_get_input_tables_from_dataset_sql(self):
        sql = """SELECT id, timestamp FROM sample_table"""
        chart = FetchChart(
            sql=sql, table_name="sample_table", table_schema="main", table_id=99
        )

        result = self.superset_db._get_input_tables(chart)[0]

        self.assertSetEqual({"id", "timestamp"}, set(result[1]))

    def test_get_input_tables_when_table_has_no_sql(self):
        chart = FetchChart(table_name="sample_table", table_schema="main", table_id=99)

        result = self.superset_db._get_input_tables(chart)[0]

        self.assertSetEqual({"id", "timestamp", "price"}, set(result[1]))
