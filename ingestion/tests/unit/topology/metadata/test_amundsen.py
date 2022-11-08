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
from metadata.generated.schema.type.entityHistory import (
    ChangeDescription,
    EntityVersion,
    FieldChange,
)
from metadata.ingestion.source.metadata.amundsen import AmundsenSource

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
        id="45add438-170e-4157-b013-0dd8b87fd8ca",
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
                "http://localhost:8585/api/v1/services/databaseServices/45add438-170e-4157-b013-0dd8b87fd8ca",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/services/databaseServices/45add438-170e-4157-b013-0dd8b87fd8ca",
            )
        ),
        changeDescription=ChangeDescription(
            fieldsAdded=[],
            fieldsUpdated=[
                FieldChange(
                    name="connection",
                    oldValue='{"config":{"type":"Hive","scheme":"hive","hostPort":"http://nohost:6000"}}',
                    newValue='{"config":{"type":"Hive","scheme":"hive","username":null,"password":null,'
                    '"hostPort":"http://nohost:6000","databaseSchema":null,"authOptions":null,'
                    '"connectionOptions":null,"connectionArguments":null,"supportsMetadataExtraction":null,'
                    '"supportsProfiler":null}}',
                )
            ],
            fieldsDeleted=[],
            previousVersion=EntityVersion(__root__=2.5),
        ),
        deleted=False,
    ),
    DatabaseService(
        id="36e3a74a-8b27-4be6-b867-d7f9e4ea7911",
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
                "http://localhost:8585/api/v1/services/databaseServices/36e3a74a-8b27-4be6-b867-d7f9e4ea7911",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/services/databaseServices/36e3a74a-8b27-4be6-b867-d7f9e4ea7911",
            )
        ),
        changeDescription=ChangeDescription(
            fieldsAdded=[],
            fieldsUpdated=[
                FieldChange(
                    name="connection",
                    oldValue='{"config":{"type":"DeltaLake","metastoreConnection":{'
                    '"metastoreHostPort":"http://localhost:9083"}}}',
                    newValue='{"config":{"type":"DeltaLake","metastoreConnection":{'
                    '"metastoreHostPort":"http://localhost:9083"},"appName":null,"connectionArguments":null,'
                    '"supportsMetadataExtraction":null}}',
                )
            ],
            fieldsDeleted=[],
            previousVersion=EntityVersion(__root__=1.6),
        ),
        deleted=False,
    ),
    DatabaseService(
        id="f1dea7a5-aa0f-4e16-af40-77e245837392",
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
                "http://localhost:8585/api/v1/services/databaseServices/f1dea7a5-aa0f-4e16-af40-77e245837392",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/services/databaseServices/f1dea7a5-aa0f-4e16-af40-77e245837392",
            )
        ),
        changeDescription=ChangeDescription(
            fieldsAdded=[],
            fieldsUpdated=[
                FieldChange(
                    name="connection",
                    oldValue='{"config":{"type":"DynamoDB","awsConfig":{"awsRegion":"aws_region"}}}',
                    newValue='{"config":{"type":"DynamoDB","awsConfig":{"awsAccessKeyId":null,'
                    '"awsSecretAccessKey":null,"awsRegion":"aws_region","awsSessionToken":null,'
                    '"endPointURL":null},"connectionOptions":null,"connectionArguments":null,'
                    '"supportsMetadataExtraction":null,"supportsProfiler":null}}',
                )
            ],
            fieldsDeleted=[],
            previousVersion=EntityVersion(__root__=1.6),
        ),
        deleted=False,
    ),
]

SERVICE_NAME = ["hive", "delta", "dynamo"]


class AmundsenUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Amundsen Unit Test
    """

    @patch("metadata.ingestion.source.pipeline.pipeline_service.test_connection")
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
            original.updatedAt = expected.updatedAt = datetime.datetime.now()
            original.version = expected.version = 2.5
            original.changeDescription.previousVersion = (
                expected.changeDescription.previousVersion
            ) = 2.5
            self.assertEqual(expected, original)
