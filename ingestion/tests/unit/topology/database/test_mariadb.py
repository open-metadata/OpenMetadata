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
Test MariaDB using the topology
"""

import types
from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import EntityName, Markdown
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.mariadb.metadata import MariadbSource
from metadata.ingestion.source.database.mariadb.models import MariaDBStoredProcedure

mock_mariadb_config = {
    "source": {
        "type": "mariadb",
        "serviceName": "local_mariadb",
        "serviceConnection": {
            "config": {
                "username": "root",
                "hostPort": "localhost:3306",
                "authType": {"password": "test"},
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "includeStoredProcedures": True,
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
            "securityConfig": {"jwtToken": "mariadb"},
        }
    },
}


class MariaDBUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    @patch("metadata.ingestion.source.database.mariadb.metadata.MariadbSource.__init__")
    def __init__(self, methodName, mock_init, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        mock_init.return_value = None

        self.config = OpenMetadataWorkflowConfig.model_validate(mock_mariadb_config)
        self.mariadb_source = MariadbSource.__new__(MariadbSource)
        self.mariadb_source.source_config = self.config.source.sourceConfig.config
        self.mariadb_source.metadata = Mock()
        self.mariadb_source.status = Mock()
        self.mariadb_source.engine = Mock()
        self.mariadb_source.context = Mock()
        self.mariadb_source.context.get = lambda: types.SimpleNamespace(
            database_service="test_service",
            database="test_db",
            database_schema="test_schema",
        )
        self.mariadb_source.register_record_stored_proc_request = Mock()
        self.mariadb_source._connection = Mock()
        self.mariadb_source._connection_map = {}

    def test_get_stored_procedures(self):
        """Test getting both stored procedures and functions"""
        mock_proc_row = Mock()
        mock_proc_row._mapping = {
            "procedure_name": "test_procedure",
            "schema_name": "test_schema",
            "definition": "BEGIN SELECT 1; END",
            "language": "SQL",
            "procedure_type": "PROCEDURE",
            "description": "Test procedure",
        }

        mock_func_row = Mock()
        mock_func_row._mapping = {
            "procedure_name": "test_function",
            "schema_name": "test_schema",
            "definition": "RETURN 1",
            "language": "SQL",
            "procedure_type": "FUNCTION",
            "description": "Test function",
        }

        with patch.object(self.mariadb_source, "engine") as mock_engine:
            mock_results = [Mock(), Mock()]
            mock_results[0].all.return_value = [mock_proc_row]
            mock_results[1].all.return_value = [mock_func_row]
            mock_engine.execute.side_effect = mock_results

            procedures = list(self.mariadb_source.get_stored_procedures())

            self.assertEqual(len(procedures), 2)
            self.assertEqual(procedures[0].name, "test_procedure")
            self.assertEqual(procedures[0].procedure_type, "PROCEDURE")
            self.assertEqual(procedures[1].name, "test_function")
            self.assertEqual(procedures[1].procedure_type, "FUNCTION")

    def test_yield_stored_procedure(self):
        """Test yielding stored procedure requests"""
        stored_proc = MariaDBStoredProcedure(
            procedure_name="test_procedure",
            schema_name="test_schema",
            definition="BEGIN SELECT 1; END",
            language="SQL",
            procedure_type="PROCEDURE",
            description="Test procedure",
        )

        with (
            patch.object(self.mariadb_source, "metadata") as mock_metadata,
            patch.object(
                self.mariadb_source, "register_record_stored_proc_request"
            ) as mock_register,
        ):
            results = list(self.mariadb_source.yield_stored_procedure(stored_proc))

            self.assertEqual(len(results), 1)
            self.assertIsInstance(results[0], Either)
            self.assertIsNotNone(results[0].right)
            self.assertIsInstance(results[0].right, CreateStoredProcedureRequest)

            request = results[0].right
            self.assertEqual(request.name, EntityName("test_procedure"))
            self.assertEqual(request.description, Markdown("Test procedure"))
            self.assertEqual(request.storedProcedureCode.code, "BEGIN SELECT 1; END")
            self.assertEqual(
                request.storedProcedureType, StoredProcedureType.StoredProcedure
            )
            mock_register.assert_called_once_with(request)
