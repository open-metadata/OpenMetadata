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
Test mysql using the topology
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.mysql.metadata import MysqlSource
from metadata.ingestion.source.database.mysql.models import MysqlStoredProcedure

mock_mysql_config = {
    "source": {
        "type": "mysql",
        "serviceName": "local_mysql1",
        "serviceConnection": {
            "config": {
                "username": "root",
                "hostPort": "localhost:3308",
                "authType": {"password": "test"},
                "sslConfig": {
                    "caCertificate": "-----BEGIN CERTIFICATE-----\nCLDQqO0R0Wer+M7+Yj5HL0T4/3euPZf4fEbh1M\n3eqn7h3iR7POOFH9tXksreiYDbDIX60phZVo0jksVSPlONyyaR87InEU4RoxXtV/\n4IGA78xlgtjL7qu6hlkzqizjFv+yQiUXPiwiSalyKx0VXs85hQx71I+3Ga1CipmW\nui+gr91udiVH\n-----END CERTIFICATE-----\n",
                    "sslCertificate": "-----BEGIN CERTIFICATE-----\nbe6xnpPXpCIcVQLgOL3wMwjrR05EWx9D0AYqArtxzJ7myfvHF4wHeu9djR5jjfS9\nZwc9/MuLhy9acck0F8wvuUiW5MoJpDr8FLMbKIiI4PdG6QVCMR0N7doZa7rCqYTq\n/7JvwqYhJezS1XirGsMHVN8Q6AJJW1+jcyl5FOt8eeTAeQRNDFeotMEXxRc3YW2x\ntzqXuATO4ZJmL7kQZnzF2D4HzOWFN4lljj8IL++foy4Lw8osKcz8DF10HYZmmAYt\nqYyGJ/nxi/faPUjp6fFwjDbwBZ65ZjqIpeV7S2JRVSgFR1UK5rQppTboRuvi+inK\nXU6PkBcOvJYVoEHgYgxBG93axr79HhBdi2W7tIcR+CsjLG6E77dxzVLv0e3XDWxu\n27d8lHmtUiHl999QyoNW2VOs5K8jnalWJBVwTK+ItoQOuyEU67HtTmFSS275fJ0V\n-----END CERTIFICATE-----\n",
                    "sslKey": "-----BEGIN PRIVATE KEY-----\nMIIJQgIBADANBgkqhkiG9w0BAQj9HOpQWDBDZHiUo+px\nzS+12L8fWblnZJSZIuoO3KPQWyFzhf7MLhyUp9NKfWECGzR/dcmyXkbYVO1acjR+\nQ05m0CwJZAfRRrLSgkrNzrDV7kZNatXF4C7Gu1+i/ODa9BajyX0UuJ5jwcpxjzxC\n8wKCAQEAnCQ5FyYyM/Ux7fIb9E9zaNh9IEW8OHybE755SOD4K743T68hBtVznk4V\niXA1mmopC7VeFHNTEB1MU4JJwl59XYk/X4W/2dlXmVo4LqKtYx7rOi62iGjR3wHc\nU/Yz1BpkkyWQaGqTw4fvP9Ho2xnurXsZ1x/es64RfxypYApmjyhIHXQNVa98paZD\nJw0ta3gIlmsLkxwSWqpS3erLGt8WUaa8+7w5RyQv5LDhyjPr4WoJcd10VBivSn0z\nZIhhO/gyZLSYyJsGt/aRTXFQyrk95V2jciH0DUId2MojOrtwslZrUzT1VJqHOWY0\nfy6xAoN1ZNv76I0mvly38KRq2ijnVg==\n-----END PRIVATE KEY-----\n",
                },
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
            "securityConfig": {"jwtToken": "mysql"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="mysql_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Mysql,
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="test_schema",
    fullyQualifiedName="mysql_source.test_db.test_schema",
    displayName="test_schema",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)


class MysqlUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_mysql_config)
        self.mysql_source = MysqlSource.create(
            mock_mysql_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

        self.mysql_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.mysql_source.context.get().__dict__["database"] = "test_db"
        self.mysql_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.mysql_source.close()

    @patch("metadata.ingestion.source.database.mysql.metadata.MysqlSource.engine")
    def test_get_stored_procedures(self, mock_engine):
        """Test fetching stored procedures"""
        # Mock the database results
        mock_results = [
            MagicMock(
                _mapping={
                    "procedure_name": "test_procedure",
                    "schema_name": "test_schema",
                    "definition": "BEGIN SELECT 1; END",
                    "procedure_type": "StoredProcedure",
                    "description": "Test stored procedure",
                }
            ),
            MagicMock(
                _mapping={
                    "procedure_name": "test_function",
                    "schema_name": "test_schema",
                    "definition": "BEGIN RETURN 1; END",
                    "procedure_type": "Function",
                    "description": "Test function",
                }
            ),
        ]

        mock_engine.execute.return_value.all.return_value = mock_results

        # Enable stored procedures in config
        self.mysql_source.source_config.includeStoredProcedures = True

        # Get stored procedures
        stored_procedures = list(self.mysql_source.get_stored_procedures())

        # Verify results
        self.assertEqual(
            len(stored_procedures), 4
        )  # 2 from procedures query, 2 from functions query
        self.assertIsInstance(stored_procedures[0], MysqlStoredProcedure)
        self.assertEqual(stored_procedures[0].name, "test_procedure")
        self.assertEqual(stored_procedures[0].procedure_type, "StoredProcedure")

    @patch("metadata.ingestion.source.database.mysql.metadata.MysqlSource.engine")
    def test_get_stored_procedures_disabled(self, mock_engine):
        """Test that stored procedures are not fetched when disabled"""
        # Disable stored procedures in config
        self.mysql_source.source_config.includeStoredProcedures = False

        # Get stored procedures
        stored_procedures = list(self.mysql_source.get_stored_procedures())

        # Verify no results
        self.assertEqual(len(stored_procedures), 0)
        mock_engine.execute.assert_not_called()

    def test_yield_stored_procedure(self):
        """Test yielding stored procedure request"""
        # Create a mock stored procedure
        stored_procedure = MysqlStoredProcedure(
            procedure_name="test_procedure",
            schema_name="test_schema",
            definition="BEGIN SELECT 1; END",
            language="SQL",
            procedure_type="StoredProcedure",
            description="Test stored procedure",
        )

        # Mock the register_record_stored_proc_request method
        self.mysql_source.register_record_stored_proc_request = MagicMock()

        # Yield stored procedure
        results = list(self.mysql_source.yield_stored_procedure(stored_procedure))

        # Verify results
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].right is not None)
        self.assertEqual(results[0].right.name.root, "test_procedure")
        self.assertEqual(results[0].right.storedProcedureType, "StoredProcedure")
        self.mysql_source.register_record_stored_proc_request.assert_called_once()

    def test_yield_stored_procedure_with_error(self):
        """Test yielding stored procedure with error handling"""
        # Create a mock stored procedure with invalid data
        stored_procedure = MysqlStoredProcedure(
            procedure_name="test_procedure",
            schema_name="test_schema",
            definition="BEGIN SELECT 1; END",
            language="SQL",
            procedure_type="StoredProcedure",
            description="Test stored procedure",
        )

        # Mock the fqn.build to raise an exception
        with patch(
            "metadata.ingestion.source.database.mysql.metadata.fqn.build"
        ) as mock_fqn:
            mock_fqn.side_effect = Exception("Test error")

            # Yield stored procedure
            results = list(self.mysql_source.yield_stored_procedure(stored_procedure))

            # Verify error result
            self.assertEqual(len(results), 1)
            self.assertTrue(results[0].left is not None)
            self.assertIn("Test error", results[0].left.error)
