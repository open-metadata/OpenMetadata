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
Test athena source
"""

import unittest
from unittest.mock import patch

from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
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
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.athena.metadata import AthenaSource
from metadata.ingestion.source.database.common_db_source import TableNameAndType

EXPECTED_DATABASE_NAMES = ["mydatabase"]
MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="sample_instance",
    fullyQualifiedName="sample_athena_schema.sample_db.sample_instance",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)
MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="sample_athena_service",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Glue,
)
MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="sample_db",
    fullyQualifiedName="test_athena.sample_db",
    displayName="sample_db",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)
MOCK_TABLE_NAME = "sample_table"
EXPECTED_DATABASES = [
    Either(
        left=None,
        right=CreateDatabaseRequest(
            name=EntityName(__root__="sample_db"),
            displayName=None,
            description=None,
            tags=None,
            owner=None,
            service=FullyQualifiedEntityName(__root__="sample_athena_service"),
            dataProducts=None,
            default=False,
            retentionPeriod=None,
            extension=None,
            sourceUrl=None,
            domain=None,
            lifeCycle=None,
            sourceHash=None,
        ),
    )
]
EXPECTED_QUERY_TABLE_NAMES_TYPES = [
    TableNameAndType(name="sample_table", type_=TableType.External)
]

mock_athena_config = {
    "source": {
        "type": "Athena",
        "serviceName": "test_athena",
        "serviceConnection": {
            "config": {
                "type": "Athena",
                "databaseName": "mydatabase",
                "awsConfig": {
                    "awsAccessKeyId": "dummy",
                    "awsSecretAccessKey": "dummy",
                    "awsRegion": "us-east-2",
                },
                "s3StagingDir": "https://s3-directory-for-datasource.com",
                "workgroup": "workgroup name",
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


class TestAthenaService(unittest.TestCase):
    @patch(
        "metadata.ingestion.source.database.database_service.DatabaseServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_athena_config)
        self.athena_source = AthenaSource.create(
            mock_athena_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.athena_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.__root__
        self.athena_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.__root__
        self.athena_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.__root__

    def test_get_database_name(self):
        assert list(self.athena_source.get_database_names()) == EXPECTED_DATABASE_NAMES

    def test_query_table_names_and_types(self):
        with patch.object(Inspector, "get_table_names", return_value=[MOCK_TABLE_NAME]):
            assert (
                self.athena_source.query_table_names_and_types(
                    MOCK_DATABASE_SCHEMA.name.__root__
                )
                == EXPECTED_QUERY_TABLE_NAMES_TYPES
            )

    def test_yield_database(self):
        assert (
            list(
                self.athena_source.yield_database(
                    database_name=MOCK_DATABASE.name.__root__
                )
            )
            == EXPECTED_DATABASES
        )
