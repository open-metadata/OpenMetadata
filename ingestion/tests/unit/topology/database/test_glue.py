import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.glue.metadata import GlueSource

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/glue_db_dataset.json"
)
with open(mock_file_path) as file:
    mock_data: dict = json.load(file)

mock_glue_config = {
    "source": {
        "type": "glue",
        "serviceName": "local_glue",
        "serviceConnection": {
            "config": {
                "type": "Glue",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
                "storageServiceName": "storage_name",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
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

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="glue_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Glue,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="glue_source.118146679784",
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
    fullyQualifiedName="glue_source.118146679784.default",
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

EXPECTED_DATABASE_NAMES = ["118146679784"]

EXPECTED_DATABASE_SCHEMA_NAMES = [
    "default",
    "mydatabase",
    "testdatalake_db",
    "zipcode-db",
]

EXPECTED_TABLE_NAMES = ["cloudfront_logs", "cloudfront_logs2", "map_table"]

EXPECTED_TABLE_TYPES = [TableType.External, TableType.Iceberg, TableType.View]


class GlueUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.glue.metadata.GlueSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_glue_config)
        self.glue_source = GlueSource.create(
            mock_glue_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.glue_source.context.__dict__["database_service"] = MOCK_DATABASE_SERVICE
        self.glue_source.context.__dict__["database"] = MOCK_DATABASE
        self.glue_source.context.__dict__["database_schema"] = MOCK_DATABASE_SCHEMA
        self.glue_source._get_glue_database_and_schemas = lambda: [
            mock_data.get("mock_database_paginator")
        ]
        self.glue_source._get_glue_tables = lambda: [
            mock_data.get("mock_table_paginator")
        ]

    def test_database_names(self):
        assert EXPECTED_DATABASE_NAMES == list(self.glue_source.get_database_names())

    def test_database_schema_names(self):
        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
            self.glue_source.get_database_schema_names()
        )

    def test_table_names(self):
        for table_and_table_type in list(self.glue_source.get_tables_name_and_type()):
            table_and_table_type[0]
            assert table_and_table_type[0] in EXPECTED_TABLE_NAMES
            assert table_and_table_type[1] in EXPECTED_TABLE_TYPES
