import types
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy.types import VARCHAR

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Constraint, DataType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.postgres.metadata import (
    GEOMETRY,
    POINT,
    POLYGON,
    PostgresSource,
)

mock_postgres_config = {
    "source": {
        "type": "postgres",
        "serviceName": "local_postgres1",
        "serviceConnection": {
            "config": {
                "type": "Postgres",
                "username": "username",
                "password": "password",
                "hostPort": "localhost:5432",
                "database": "postgres",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
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
MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="postgres_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Postgres,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="postgres_source.default",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="postgres_source.118146679784.default",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
)


MOCK_COLUMN_VALUE = [
    {
        "name": "username",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "geom_c",
        "type": GEOMETRY(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "geometry",
        "comment": None,
    },
    {
        "name": "point_c",
        "type": POINT(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "point",
        "comment": None,
    },
    {
        "name": "polygon_c",
        "type": POLYGON(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
        "system_data_type": "polygon",
    },
]


EXPECTED_COLUMN_VALUE = [
    Column(
        name="username",
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="varchar(50)",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="geom_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="geometry",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="point_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="point",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="polygon_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="polygon",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
]


class PostgresUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_postgres_config)
        self.postgres_source = PostgresSource.create(
            mock_postgres_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

        self.postgres_source.context.__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE
        self.postgres_source.context.__dict__["database"] = MOCK_DATABASE
        self.postgres_source.context.__dict__["database_schema"] = MOCK_DATABASE_SCHEMA

    def test_datatype(self):
        inspector = types.SimpleNamespace()
        inspector.get_columns = (
            lambda table_name, schema_name, db_name: MOCK_COLUMN_VALUE
        )
        inspector.get_pk_constraint = lambda table_name, schema_name: []
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []
        result, _, _ = self.postgres_source.get_columns_and_constraints(
            "public", "user", "postgres", inspector
        )
        for i in range(len(EXPECTED_COLUMN_VALUE)):
            self.assertEqual(result[i], EXPECTED_COLUMN_VALUE[i])
