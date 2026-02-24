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
from unittest.mock import MagicMock, patch

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
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.oracle.metadata import OracleSource
from metadata.ingestion.source.database.oracle.models import OracleStoredObject
from metadata.ingestion.source.database.oracle.queries import (
    ORACLE_GET_STORED_PACKAGES,
    ORACLE_GET_STORED_PROCEDURES,
    TEST_ORACLE_GET_STORED_PACKAGES,
)

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

    def test_stored_procedure_queries_have_order_by(self):
        """
        Test that stored procedure queries have ORDER BY clause to ensure
        lines are returned in correct order from the database.

        This is critical because the process_result method concatenates text
        as rows are received without reordering. Without ORDER BY, Oracle can
        return rows in any physical order, causing scrambled code.
        """
        assert "ORDER BY OWNER, NAME, LINE" in ORACLE_GET_STORED_PROCEDURES
        assert (
            """ORDER BY OWNER, NAME, CASE type
        WHEN 'PACKAGE' THEN 1
        WHEN 'PACKAGE BODY' THEN 2
        ELSE 3
    END, LINE"""
            in ORACLE_GET_STORED_PACKAGES
        )
        assert (
            """ORDER BY OWNER, NAME, CASE type
        WHEN 'PACKAGE' THEN 1
        WHEN 'PACKAGE BODY' THEN 2
        ELSE 3
    END, LINE"""
            in TEST_ORACLE_GET_STORED_PACKAGES
        )

    def test_get_view_definition_with_view_def_and_view_ddl(self):
        """
        Test that view definitions are correctly retrieved for both cases:
        1. When view_def is present (regular view with text column)
        2. When view_ddl is present (view definition from DBMS_METADATA.GET_DDL)
        """
        from unittest.mock import MagicMock

        from sqlalchemy.dialects.oracle.base import OracleDialect

        from metadata.ingestion.source.database.oracle.utils import (
            get_all_view_definitions,
        )

        mock_connection = MagicMock()
        mock_dialect = OracleDialect()

        class MockViewRowWithViewDef:
            view_name = "test_view_with_def"
            schema = "test_schema"
            view_def = "SELECT * FROM test_table WHERE id > 0"
            view_ddl = None

        class MockViewRowWithViewDdl:
            VIEW_NAME = "test_view_with_ddl"
            SCHEMA = "test_schema"
            VIEW_DEF = None
            VIEW_DDL = "CREATE OR REPLACE FORCE VIEW test_schema.test_view_with_ddl AS SELECT * FROM complex_table"

        mock_result = [MockViewRowWithViewDef(), MockViewRowWithViewDdl()]
        mock_connection.execute.return_value = mock_result
        mock_connection.engine.url.database = "test_database"

        get_all_view_definitions(mock_dialect, mock_connection, "dummy_query")

        assert hasattr(mock_dialect, "all_view_definitions")
        assert (
            "test_view_with_def",
            "test_schema",
        ) in mock_dialect.all_view_definitions
        assert (
            "test_view_with_ddl",
            "test_schema",
        ) in mock_dialect.all_view_definitions

        expected_view_def_definition = "CREATE OR REPLACE VIEW test_view_with_def AS SELECT * FROM test_table WHERE id > 0"
        expected_view_ddl_definition = "CREATE OR REPLACE FORCE VIEW test_schema.test_view_with_ddl AS SELECT * FROM complex_table"

        assert (
            mock_dialect.all_view_definitions[("test_view_with_def", "test_schema")]
            == expected_view_def_definition
        )
        assert (
            mock_dialect.all_view_definitions[("test_view_with_ddl", "test_schema")]
            == expected_view_ddl_definition
        )

    def test_get_stored_procedures(self):
        """
        Test fetching stored procedures with filter
        """
        self.oracle.source_config.includeStoredProcedures = True
        self.oracle.source_config.storedProcedureFilterPattern = FilterPattern(
            includes=["sp_include"]
        )
        self.oracle.context.get().__dict__["database"] = "test_db"
        self.oracle.context.get().__dict__["database_schema"] = "test_schema"

        mock_engine = MagicMock()
        self.oracle.engine = mock_engine

        # Row format: owner, name, line, text, procedure_type
        rows_procedures = [
            ("owner", "sp_include", 1, "def1", "StoredProcedure"),
            ("owner", "sp_exclude", 1, "def2", "StoredProcedure"),
        ]

        rows_packages = []

        mock_result_proc = MagicMock()
        mock_result_proc.all.return_value = rows_procedures

        mock_result_pkg = MagicMock()
        mock_result_pkg.all.return_value = rows_packages

        mock_engine.execute.side_effect = [mock_result_proc, mock_result_pkg]

        results = list(self.oracle.get_stored_procedures())

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].name, "sp_include")
