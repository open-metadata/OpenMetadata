"""
TestCase for Amundsen using the topology
"""

import datetime
from unittest import TestCase
from unittest.mock import patch

from pydantic import AnyUrl

from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
    MetastoreHostPortConnection,
)
from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.type.basic import Href
from metadata.ingestion.source.metadata.amundsen.metadata import AmundsenSource

mock_amundsen_config = {
    "source": {
        "type": "amundsen",
        "serviceName": "local_amundsen",
        "serviceConnection": {
            "config": {
                "type": "Amundsen",
                "username": "neo4j",
                "password": "test",
                "hostPort": "bolt://192.168.1.8:7687",
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
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

EXPECTED_SERVICE = [
    DatabaseService(
        id="05f98ea5-1a30-480c-9bfc-55d1eabc45c7",
        name="hive",
        fullyQualifiedName="hive",
        displayName="hive",
        serviceType="Hive",
        description=None,
        connection=DatabaseConnection(
            config=HiveConnection(
                type="Hive",
                scheme="hive",
                username=None,
                password=None,
                hostPort="http://nohost:6000",
                databaseSchema=None,
                authOptions=None,
                connectionOptions=None,
                connectionArguments=None,
                supportsMetadataExtraction=True,
                supportsProfiler=True,
            )
        ),
        pipelines=None,
        version=2.5,
        updatedAt=1667892646744,
        updatedBy="admin",
        owner=None,
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/services/databaseServices/05f98ea5-1a30-480c-9bfc-55d1eabc45c7",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/services/databaseServices/05f98ea5-1a30-480c-9bfc-55d1eabc45c7",
            )
        ),
        changeDescription=None,
        deleted=False,
    ),
    DatabaseService(
        id="e856d239-4e74-4a7d-844b-d61c3e73b81d",
        name="delta",
        fullyQualifiedName="delta",
        displayName="delta",
        serviceType="DeltaLake",
        description=None,
        connection=DatabaseConnection(
            config=DeltaLakeConnection(
                type="DeltaLake",
                metastoreConnection=MetastoreHostPortConnection(
                    metastoreHostPort="http://localhost:9083"
                ),
                connectionArguments=None,
                supportsMetadataExtraction=True,
            )
        ),
        pipelines=None,
        version=2.5,
        updatedAt=1667892646744,
        updatedBy="admin",
        owner=None,
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/services/databaseServices/e856d239-4e74-4a7d-844b-d61c3e73b81d",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/services/databaseServices/e856d239-4e74-4a7d-844b-d61c3e73b81d",
            )
        ),
        changeDescription=None,
        deleted=False,
    ),
    DatabaseService(
        id="836ff98d-a241-4d06-832d-745f96ac88fc",
        name="dynamo",
        fullyQualifiedName="dynamo",
        displayName="dynamo",
        serviceType="DynamoDB",
        description=None,
        connection=DatabaseConnection(
            config=DynamoDBConnection(
                type="DynamoDB",
                awsConfig=AWSCredentials(awsRegion="aws_region"),
                connectionArguments=None,
                supportsMetadataExtraction=True,
            )
        ),
        pipelines=None,
        version=2.5,
        updatedAt=1667892646744,
        updatedBy="admin",
        owner=None,
        href=Href(
            __root__=AnyUrl(
                "http://localhost:8585/api/v1/services/databaseServices/836ff98d-a241-4d06-832d-745f96ac88fc",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/services/databaseServices/836ff98d-a241-4d06-832d-745f96ac88fc",
            )
        ),
        changeDescription=None,
        deleted=False,
    ),
]

SERVICE_NAME = ["hive", "delta", "dynamo"]


class AmundsenUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Amundsen Unit Test
    """

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_amundsen_config)
        self.amundsen = AmundsenSource.create(
            mock_amundsen_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_database_service(self):
        database_service_list = []
        for service_name in SERVICE_NAME:
            service_entity = self.amundsen.get_database_service(service_name)
            database_service_list.append(service_entity)

        for _, (expected, original) in enumerate(
            zip(EXPECTED_SERVICE, database_service_list)
        ):
            original.id = expected.id = "836ff98d-a241-4d06-832d-745f96ac88fc"
            original.href = expected.href = None
            original.updatedAt = expected.updatedAt = datetime.datetime.now()
            original.version = expected.version = 2.5
            original.changeDescription = None
            self.assertEqual(expected, original)
