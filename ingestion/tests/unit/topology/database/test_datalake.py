from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource

mock_datalake_config = {
    "source": {
        "type": "datalake",
        "serviceName": "local_datalake",
        "serviceConnection": {
            "config": {
                "type": "Datalake",
                "configSource": {
                    "securityConfig": {
                        "awsAccessKeyId": "aws_access_key_id",
                        "awsSecretAccessKey": "aws_secret_access_key",
                        "awsRegion": "us-east-2",
                        "endPointURL": "https://endpoint.com/",
                    }
                },
                "bucketName": "bucket name",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "schemaFilterPattern": {
                    "excludes": [
                        "^test.*",
                        ".*test$",
                    ]
                },
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

MOCK_S3_SCHEMA = {
    "Buckets": [
        {"Name": "test_datalake"},
        {"Name": "test_gcs"},
        {"Name": "s3_test"},
        {"Name": "my_bucket"},
    ]
}

MOCK_GCS_SCHEMA = [
    SimpleNamespace(name="test_datalake"),
    SimpleNamespace(name="test_gcs"),
    SimpleNamespace(name="s3_test"),
    SimpleNamespace(name="my_bucket"),
]

EXPECTED_SCHEMA = ["my_bucket"]


MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="local_datalake",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Postgres,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="local_datalake.default",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)


class DatalakeUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.datalake.metadata.DatalakeSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_datalake_config)
        self.datalake_source = DatalakeSource.create(
            mock_datalake_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.datalake_source.context.__dict__["database"] = MOCK_DATABASE
        self.datalake_source.context.__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE

    def test_s3_schema_filer(self):
        self.datalake_source.client.list_buckets = lambda: MOCK_S3_SCHEMA
        assert list(self.datalake_source.fetch_s3_bucket_names()) == EXPECTED_SCHEMA

    def test_gcs_schema_filer(self):
        self.datalake_source.client.list_buckets = lambda: MOCK_GCS_SCHEMA
        assert list(self.datalake_source.fetch_gcs_bucket_names()) == EXPECTED_SCHEMA
