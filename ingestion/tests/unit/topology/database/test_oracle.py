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
Test Oracle using the topology
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureCode
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.oracle.metadata import OracleSource
from metadata.ingestion.source.database.oracle.models import OracleStoredProcedure

mock_oracle_config = {
    "source": {
        "type": "oracle",
        "serviceName": "test2",
        "serviceConnection": {
            "config": {
                "type": "Oracle",
                "oracleConnectionType": {"oracleServiceName": "TESTDB"},
                "username": "username",
                "password": "password",
                "hostPort": "localhost:1466",
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

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="oracle_source_test",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Oracle,
)

MOCK_DATABASE = Database(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="sample_database",
    fullyQualifiedName="oracle_source_test.sample_database",
    displayName="sample_database",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="sample_schema",
    fullyQualifiedName="mssql_source_test.sample_database.sample_schema",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="database"),
    database=EntityReference(
        id="a58b1856-729c-493b-bc87-6d2269b43ec0",
        type="database",
    ),
)

MOCK_STORED_PROCEDURE = OracleStoredProcedure(
    name="sample_procedure",
    definition="SAMPLE_SQL_TEXT",
    owner="sample_stored_prcedure_owner",
)

EXPECTED_DATABASE = [
    CreateDatabaseRequest(
        name=EntityName(__root__="sample_database"),
        displayName=None,
        description=None,
        tags=None,
        owner=None,
        service=FullyQualifiedEntityName(__root__="oracle_source_test"),
        dataProducts=None,
        default=False,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        domain=None,
        lifeCycle=None,
        sourceHash=None,
    )
]

EXPECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName(__root__="sample_schema"),
        displayName=None,
        description=None,
        owner=None,
        database=FullyQualifiedEntityName(
            __root__="oracle_source_test.sample_database"
        ),
        dataProducts=None,
        tags=None,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        domain=None,
        lifeCycle=None,
        sourceHash=None,
    )
]

EXPECTED_STORED_PROCEDURE = [
    CreateStoredProcedureRequest(
        name=EntityName(__root__="sample_procedure"),
        displayName=None,
        description=None,
        owner=None,
        tags=None,
        storedProcedureCode=StoredProcedureCode(language="SQL", code="SAMPLE_SQL_TEXT"),
        databaseSchema=FullyQualifiedEntityName(
            __root__="oracle_source_test.sample_database.sample_schema"
        ),
        extension=None,
        dataProducts=None,
        sourceUrl=None,
        domain=None,
        lifeCycle=None,
        sourceHash=None,
    )
]


class OracleUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Oracle Unit Test
    """

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(
        self,
        methodName,
        test_connection,
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_oracle_config)
        self.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(
                mock_oracle_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )
        self.oracle = OracleSource.create(
            mock_oracle_config["source"],
            self.metadata,
        )
        self.oracle.context.__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.__root__

    def test_yield_database(self):
        assert EXPECTED_DATABASE == [
            either.right for either in self.oracle.yield_database(MOCK_DATABASE.name)
        ]

        self.oracle.context.__dict__["database"] = MOCK_DATABASE.name.__root__

    def test_yield_schema(self):
        assert EXPECTED_DATABASE_SCHEMA == [
            either.right
            for either in self.oracle.yield_database_schema(MOCK_DATABASE_SCHEMA.name)
        ]
        self.oracle.context.__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.__root__

    def test_yield_stored_procedure(self):
        assert EXPECTED_STORED_PROCEDURE == [
            either.right
            for either in self.oracle.yield_stored_procedure(MOCK_STORED_PROCEDURE)
        ]
