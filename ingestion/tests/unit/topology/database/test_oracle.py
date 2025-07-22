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
from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedureCode,
    StoredProcedureType,
)
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
from metadata.ingestion.source.database.oracle.models import OracleStoredObject

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
            "securityConfig": {"jwtToken": "oracle"},
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

MOCK_STORED_PROCEDURE = OracleStoredObject(
    name="sample_procedure",
    definition="SAMPLE_SQL_TEXT",
    owner="sample_stored_prcedure_owner",
    procedure_type="StoredProcedure",
)

MOCK_STORED_PACKAGE = OracleStoredObject(
    name="sample_package",
    definition="SAMPLE_SQL_TEXT",
    owner="sample_stored_package_owner",
    procedure_type="StoredPackage",
)

EXPECTED_DATABASE = [
    CreateDatabaseRequest(
        name=EntityName("sample_database"),
        service=FullyQualifiedEntityName("oracle_source_test"),
        default=False,
    )
]

EXPECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName("sample_schema"),
        database=FullyQualifiedEntityName("oracle_source_test.sample_database"),
    )
]

EXPECTED_STORED_PROCEDURE = [
    CreateStoredProcedureRequest(
        name=EntityName("sample_procedure"),
        storedProcedureCode=StoredProcedureCode(language="SQL", code="SAMPLE_SQL_TEXT"),
        storedProcedureType=StoredProcedureType.StoredProcedure,
        databaseSchema=FullyQualifiedEntityName(
            "oracle_source_test.sample_database.sample_schema"
        ),
    )
]

EXPECTED_STORED_PACKAGE = [
    CreateStoredProcedureRequest(
        name=EntityName("sample_package"),
        storedProcedureCode=StoredProcedureCode(language="SQL", code="SAMPLE_SQL_TEXT"),
        storedProcedureType=StoredProcedureType.StoredPackage,
        databaseSchema=FullyQualifiedEntityName(
            "oracle_source_test.sample_database.sample_schema"
        ),
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
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_oracle_config)
        self.metadata = OpenMetadata(
            OpenMetadataConnection.model_validate(
                mock_oracle_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )
        self.oracle = OracleSource.create(
            mock_oracle_config["source"],
            self.metadata,
        )
        self.oracle.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root

    def test_yield_database(self):
        assert EXPECTED_DATABASE == [
            either.right
            for either in self.oracle.yield_database(MOCK_DATABASE.name.root)
        ]

        self.oracle.context.get().__dict__["database"] = MOCK_DATABASE.name.root

    def test_yield_schema(self):
        assert EXPECTED_DATABASE_SCHEMA == [
            either.right
            for either in self.oracle.yield_database_schema(
                MOCK_DATABASE_SCHEMA.name.root
            )
        ]
        self.oracle.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    def test_yield_stored_procedure(self):
        assert EXPECTED_STORED_PROCEDURE == [
            either.right
            for either in self.oracle.yield_stored_procedure(MOCK_STORED_PROCEDURE)
        ]

    def test_yield_stored_package(self):
        assert EXPECTED_STORED_PACKAGE == [
            either.right
            for either in self.oracle.yield_stored_procedure(MOCK_STORED_PACKAGE)
        ]
