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
"""Regression tests for the Azure SQL source mark-deleted flow.

Azure SQL Database (the single-database tier) rejects the cross-database
reference ``master.sys.databases`` with error 40515, and the
``mark_databases_as_deleted`` post-process step used to run that query even
in single-database mode, bypassing the ``get_configured_database`` short-circuit.
These tests pin both the query and the short-circuit so the bug cannot return.
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.azuresql.metadata import AzuresqlSource
from metadata.ingestion.source.database.azuresql.queries import AZURE_SQL_GET_DATABASES

mock_azuresql_config = {
    "source": {
        "type": "azuresql",
        "serviceName": "test_azuresql",
        "serviceConnection": {
            "config": {
                "type": "AzureSQL",
                "username": "username",
                "password": "password",
                "hostPort": "myhost:1433",
                "database": "mydb",
                "driver": "ODBC Driver 18 for SQL Server",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "azuresql"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="azuresql_source_test",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.AzureSQL,
)


class AzuresqlUnitTest(TestCase):
    """Regression tests for the Azure SQL source mark-deleted flow."""

    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def setUp(self, test_connection) -> None:
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_azuresql_config)
        self.azuresql = AzuresqlSource.create(
            mock_azuresql_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.azuresql.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        # Empty filter pattern so the helper does not drop the configured database.
        self.azuresql.source_config.databaseFilterPattern = None
        self.azuresql.source_config.useFqnForFiltering = False

    @property
    def _connection_config(self):
        return self.azuresql.config.serviceConnection.root.config

    def test_azure_sql_get_databases_query_does_not_use_master_prefix(self):
        """Azure SQL Database rejects three-part names (``master.sys.databases``)
        with error 40515. The listing query must use the in-context
        ``sys.databases`` form that works on every tier."""
        assert "master." not in AZURE_SQL_GET_DATABASES
        assert AZURE_SQL_GET_DATABASES == "SELECT name FROM sys.databases order by name"

    def test_get_filtered_database_names_short_circuits_to_configured_db_in_single_db_mode(self):
        """In single-database mode the helper must yield only the configured
        database and never call ``get_database_names_raw`` (the server-wide
        listing), mirroring the topology walk's short-circuit."""
        self._connection_config.ingestAllDatabases = False
        with patch.object(self.azuresql, "get_database_names_raw") as mock_raw:
            result = list(self.azuresql._get_filtered_database_names())
        assert result == ["mydb"]
        mock_raw.assert_not_called()

    def test_mark_databases_as_deleted_single_db_mode_executes_no_listing_sql(self):
        """End-to-end proof the listing query never reaches the wire in
        single-database mode: a real ``connection.execute`` mock records every
        statement the post-process step runs, and none of them is the
        ``sys.databases`` listing. This is the bug repro - on the un-fixed code
        the captured SQL is ``['SELECT name FROM master.sys.databases order by name']``."""
        self._connection_config.ingestAllDatabases = False
        self.azuresql.source_config.markDeletedDatabases = True
        self.azuresql.database_entity_source_state = set()

        executed_statements: list[str] = []

        def fake_execute(statement, *_args, **_kwargs):
            executed_statements.append(str(statement))
            return MagicMock(fetchall=list)

        thread_id = self.azuresql.context.get_current_thread_id()
        mock_connection = MagicMock()
        mock_connection.execute.side_effect = fake_execute
        self.azuresql._connection_map[thread_id] = mock_connection

        with (
            patch.object(self.azuresql, "set_inspector"),
            patch("metadata.ingestion.source.database.database_service.delete_entity_from_source") as mock_delete,
        ):
            mock_delete.return_value = iter([])
            list(self.azuresql.mark_databases_as_deleted())

        assert not any("sys.databases" in stmt for stmt in executed_statements), executed_statements
        mock_delete.assert_called_once()

    def test_mark_databases_as_deleted_multi_db_mode_lists_databases(self):
        """No regression for ingest-all-databases mode: the raw listing is
        still called and every returned database lands in the source state."""
        self._connection_config.ingestAllDatabases = True
        self.azuresql.source_config.markDeletedDatabases = True
        self.azuresql.database_entity_source_state = set()
        with (
            patch.object(
                self.azuresql,
                "get_database_names_raw",
                return_value=iter(["db_one", "db_two"]),
            ) as mock_raw,
            patch("metadata.ingestion.source.database.database_service.delete_entity_from_source") as mock_delete,
        ):
            mock_delete.return_value = iter([])
            list(self.azuresql.mark_databases_as_deleted())
        mock_raw.assert_called_once()
        mock_delete.assert_called_once()
        call_args = mock_delete.call_args
        assert call_args.kwargs["entity_type"] is Database
        assert call_args.kwargs["recursive"] is True
        assert call_args.kwargs["params"] == {"service": MOCK_DATABASE_SERVICE.name.root}
        assert call_args.kwargs["entity_source_state"] == {
            f"{MOCK_DATABASE_SERVICE.name.root}.db_one",
            f"{MOCK_DATABASE_SERVICE.name.root}.db_two",
        }
