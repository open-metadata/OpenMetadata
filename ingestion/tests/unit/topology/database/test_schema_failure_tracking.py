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
Test schema failure tracking to prevent unwanted table deletions
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
from metadata.ingestion.source.database.postgres.metadata import PostgresSource
from metadata.utils import fqn


mock_config = {
    "source": {
        "type": "postgres",
        "serviceName": "test_service",
        "serviceConnection": {
            "config": {
                "type": "Postgres",
                "username": "username",
                "authType": {
                    "password": "password",
                },
                "hostPort": "localhost:5432",
                "database": "testdb",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "markDeletedTables": True,
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
            "securityConfig": {"jwtToken": "test"},
        }
    },
}


class TestSchemaFailureTracking(TestCase):
    """
    Test that schema failure tracking prevents unwanted table deletions
    """

    @patch(
        "metadata.ingestion.source.database.postgres.connection.get_connection",
        return_value=None,
    )
    @patch("metadata.ingestion.ometa.ometa_api.OpenMetadata")
    def setUp(self, OpenMetadata, mock_get_connection) -> None:
        """
        Set up test resources
        """
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_config)
        self.postgres_source = PostgresSource.create(
            mock_config["source"],
            MagicMock(),
        )
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"
        self.postgres_source.context.get().__dict__["database"] = "testdb"

    def test_schema_failure_is_tracked(self):
        """
        Test that schema failures are added to schema_table_listing_failed set
        """
        # Mock the schema context
        self.postgres_source.context.get().__dict__["database_schema"] = "test_schema"

        # Set up the source to raise an exception when listing tables
        with patch.object(
            self.postgres_source, "query_table_names_and_types", side_effect=Exception("Connection failed")
        ):
            # Call get_tables_name_and_type which should catch the exception
            list(self.postgres_source.get_tables_name_and_type())

        # Verify that the failed schema was recorded
        expected_schema_fqn = fqn.build(
            self.postgres_source.metadata,
            entity_type=DatabaseSchema,
            service_name="test_service",
            database_name="testdb",
            schema_name="test_schema",
        )
        
        self.assertIn(
            expected_schema_fqn,
            self.postgres_source.schema_table_listing_failed,
            "Failed schema should be tracked in schema_table_listing_failed set"
        )

    def test_mark_deleted_skips_failed_schemas(self):
        """
        Test that mark_tables_as_deleted skips schemas with listing failures
        """
        # Mock the schema context
        test_schema = "test_schema"
        self.postgres_source.context.get().__dict__["database_schema"] = test_schema

        # Build schema FQN
        schema_fqn = fqn.build(
            self.postgres_source.metadata,
            entity_type=DatabaseSchema,
            service_name="test_service",
            database_name="testdb",
            schema_name=test_schema,
        )

        # Add schema to failed set
        self.postgres_source.schema_table_listing_failed.add(schema_fqn)

        # Mock _get_filtered_schema_names to return the failed schema
        with patch.object(
            self.postgres_source, "_get_filtered_schema_names", return_value=[schema_fqn]
        ):
            # Mock delete_entity_from_source to track if it's called
            with patch("metadata.ingestion.source.database.database_service.delete_entity_from_source") as mock_delete:
                # Call mark_tables_as_deleted
                list(self.postgres_source.mark_tables_as_deleted())

                # Verify delete_entity_from_source was NOT called for the failed schema
                mock_delete.assert_not_called()

    def test_mark_deleted_processes_successful_schemas(self):
        """
        Test that mark_tables_as_deleted processes schemas without listing failures
        """
        # Mock the schema context
        test_schema = "test_schema"
        self.postgres_source.context.get().__dict__["database_schema"] = test_schema

        # Build schema FQN
        schema_fqn = fqn.build(
            self.postgres_source.metadata,
            entity_type=DatabaseSchema,
            service_name="test_service",
            database_name="testdb",
            schema_name=test_schema,
        )

        # DO NOT add schema to failed set (simulating successful listing)

        # Mock _get_filtered_schema_names to return the schema
        with patch.object(
            self.postgres_source, "_get_filtered_schema_names", return_value=[schema_fqn]
        ):
            # Mock delete_entity_from_source to track if it's called
            with patch("metadata.ingestion.source.database.database_service.delete_entity_from_source", return_value=[]) as mock_delete:
                # Call mark_tables_as_deleted
                list(self.postgres_source.mark_tables_as_deleted())

                # Verify delete_entity_from_source WAS called for the successful schema
                mock_delete.assert_called_once()
