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
Test Azure SQL using the topology
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
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.azuresql.metadata import AzuresqlSource
from metadata.ingestion.source.database.azuresql.queries import (
    AZURE_SQL_GET_DATABASES,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource

mock_azuresql_config = {
    "source": {
        "type": "azuresql",
        "serviceName": "test_azuresql",
        "serviceConnection": {
            "config": {
                "type": "AzureSQL",
                "hostPort": "test-server.database.windows.net",
                "database": "test_db",
                "username": "testuser",
                "password": "testpass",
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
    name="azuresql_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.AzureSQL,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="test_db",
    fullyQualifiedName="azuresql_source.test_db",
    displayName="test_db",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)


class AzuresqlUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_azuresql_config)
        self.azuresql_source = AzuresqlSource.create(
            mock_azuresql_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.azuresql_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.azuresql_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.root

    def test_azuresql_is_multi_db_source(self):
        """Verify AzuresqlSource implements MultiDBSource"""
        assert isinstance(self.azuresql_source, MultiDBSource)

    def test_get_configured_database_single_db(self):
        """When ingestAllDatabases=false, returns the configured database name"""
        self.azuresql_source.service_connection.ingestAllDatabases = False
        result = self.azuresql_source.get_configured_database()
        assert result == "test_db"

    def test_get_configured_database_all_dbs(self):
        """When ingestAllDatabases=true, returns None"""
        self.azuresql_source.service_connection.ingestAllDatabases = True
        result = self.azuresql_source.get_configured_database()
        assert result is None

    def test_azure_sql_get_databases_query_uses_sys_databases(self):
        """Verify the query uses sys.databases without master. prefix
        (master.sys.databases is not supported on Azure SQL Database)"""
        assert "master" not in AZURE_SQL_GET_DATABASES
        assert "sys.databases" in AZURE_SQL_GET_DATABASES

    def test_mark_deleted_databases_skipped_single_db(self):
        """When ingestAllDatabases=false, mark_databases_as_deleted should be skipped
        entirely — avoids querying sys.databases on Azure SQL Database which
        only returns the current database anyway"""
        mock_source_config = MagicMock()
        mock_source_config.markDeletedDatabases = True
        self.azuresql_source.source_config = mock_source_config

        with patch.object(
            self.azuresql_source, "get_configured_database", return_value="test_db"
        ):
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                result = list(self.azuresql_source.mark_databases_as_deleted())

                assert result == []
                mock_delete.assert_not_called()

    def test_mark_deleted_databases_runs_when_ingest_all(self):
        """When ingestAllDatabases=true, mark_databases_as_deleted should proceed"""
        mock_source_config = MagicMock()
        mock_source_config.markDeletedDatabases = True
        self.azuresql_source.source_config = mock_source_config

        self.azuresql_source.context.get().__dict__[
            "database_service"
        ] = "test_service"
        self.azuresql_source.database_entity_source_state = {"test_db_fqn"}

        with patch.object(
            self.azuresql_source, "get_configured_database", return_value=None
        ):
            with patch.object(
                self.azuresql_source, "_get_filtered_database_names"
            ) as mock_filtered_dbs:
                mock_filtered_dbs.return_value = ["test_db"]

                with patch(
                    "metadata.ingestion.source.database.database_service.delete_entity_from_source"
                ) as mock_delete:
                    mock_delete.return_value = iter([])

                    list(self.azuresql_source.mark_databases_as_deleted())

                    mock_delete.assert_called_once()

    def test_mark_deleted_databases_disabled(self):
        """When markDeletedDatabases=false, nothing happens regardless of ingestAllDatabases"""
        mock_source_config = MagicMock()
        mock_source_config.markDeletedDatabases = False
        self.azuresql_source.source_config = mock_source_config

        with patch.object(
            self.azuresql_source, "get_configured_database", return_value=None
        ):
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                result = list(self.azuresql_source.mark_databases_as_deleted())

                assert result == []
                mock_delete.assert_not_called()

    def test_get_database_names_single_db(self):
        """When ingestAllDatabases=false, yields only the configured database"""
        self.azuresql_source.config.serviceConnection.root.config.ingestAllDatabases = (
            False
        )

        with patch.object(self.azuresql_source, "set_inspector"):
            names = list(self.azuresql_source.get_database_names())

        assert names == ["test_db"]
