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
Test Postgres using the topology
"""

import types
from unittest import TestCase
from unittest.mock import MagicMock, patch

from sqlalchemy.types import VARCHAR

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    DataType,
    TableType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.common_pg_mappings import (
    GEOMETRY,
    POINT,
    POLYGON,
)
from metadata.ingestion.source.database.postgres.metadata import PostgresSource
from metadata.ingestion.source.database.postgres.usage import PostgresUsageSource
from metadata.ingestion.source.database.postgres.utils import get_postgres_version

mock_postgres_config = {
    "source": {
        "type": "postgres",
        "serviceName": "local_postgres1",
        "serviceConnection": {
            "config": {
                "type": "Postgres",
                "username": "username",
                "authType": {
                    "password": "password",
                },
                "hostPort": "localhost:5432",
                "database": "postgres",
                "sslMode": "verify-ca",
                "sslConfig": {
                    "caCertificate": "CA certificate content",
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
            "securityConfig": {"jwtToken": "postgres"},
        }
    },
}

mock_postgres_usage_config = {
    "source": {
        "type": "postgres-usage",
        "serviceName": "local_postgres1",
        "serviceConnection": {
            "config": {
                "type": "Postgres",
                "username": "username",
                "authType": {
                    "password": "password",
                },
                "hostPort": "localhost:5432",
                "database": "postgres",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseUsage",
                "queryLogDuration": 1,
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
            "securityConfig": {"jwtToken": "postgres"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="postgres_source",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Postgres,
)

MOCK_DATABASE = Database(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name="118146679784",
    fullyQualifiedName="postgres_source.default",
    displayName="118146679784",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="2aaa012e-099a-11ed-861d-0242ac120056",
    name="default",
    fullyQualifiedName="postgres_source.118146679784.default",
    displayName="default",
    description="",
    database=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
    service=EntityReference(
        id="2aaa012e-099a-11ed-861d-0242ac120002",
        type="database",
    ),
)


MOCK_COLUMN_VALUE = [
    {
        "name": "username",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "geom_c",
        "type": GEOMETRY(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "geometry",
        "comment": None,
    },
    {
        "name": "point_c",
        "type": POINT(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "point",
        "comment": None,
    },
    {
        "name": "polygon_c",
        "type": POLYGON(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
        "system_data_type": "polygon",
    },
]


EXPECTED_COLUMN_VALUE = [
    Column(
        name="username",
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="varchar(50)",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="geom_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="geometry",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="point_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="point",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="polygon_c",
        displayName=None,
        dataType=DataType.GEOMETRY,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="polygon",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
]


class PostgresUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_postgres_config)
        self.postgres_source = PostgresSource.create(
            mock_postgres_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

        self.postgres_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.postgres_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.root
        self.postgres_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

        self.usage_config = OpenMetadataWorkflowConfig.model_validate(
            mock_postgres_usage_config
        )
        with patch(
            "metadata.ingestion.source.database.postgres.usage.PostgresUsageSource.test_connection"
        ):
            self.postgres_usage_source = PostgresUsageSource.create(
                mock_postgres_usage_config["source"],
                self.usage_config.workflowConfig.openMetadataServerConfig,
            )

    def test_datatype(self):
        inspector = types.SimpleNamespace()
        inspector.get_columns = (
            lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        )
        inspector.get_pk_constraint = lambda table_name, schema_name: []
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []
        result, _, _ = self.postgres_source.get_columns_and_constraints(
            "public", "user", "postgres", inspector, TableType.Regular
        )
        for i, _ in enumerate(EXPECTED_COLUMN_VALUE):
            self.assertEqual(result[i], EXPECTED_COLUMN_VALUE[i])

    @patch("sqlalchemy.engine.base.Engine")
    def test_get_version_info(self, engine):
        # outdated with a switch to get_server_version_num instead of get_+server_version
        # engine.execute.return_value = [["15.3 (Debian 15.3-1.pgdg110+1)"]]
        # self.assertEqual("15.3", get_postgres_version(engine))

        engine.execute.return_value = [["110016"]]
        self.assertEqual("110016", get_postgres_version(engine))

        engine.execute.return_value = [["90624"]]
        self.assertEqual("90624", get_postgres_version(engine))

        engine.execute.return_value = [[]]
        self.assertIsNone(get_postgres_version(engine))

    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.postgres_source.close()

    def test_mark_deleted_schemas_enabled(self):
        """Test mark deleted schemas when the config is enabled"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedSchemas = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database information
        self.postgres_source.context.get().__dict__["database"] = "test_db"
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock the schema entity source state
        self.postgres_source.schema_entity_source_state = {"test_schema_fqn"}

        # Mock the _get_filtered_schema_names method
        with patch.object(
            self.postgres_source, "_get_filtered_schema_names"
        ) as mock_filtered_schemas:
            mock_filtered_schemas.return_value = [
                "test_schema_fqn",
                "another_schema_fqn",
            ]

            # Mock the delete_entity_from_source function
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                mock_delete.return_value = iter([])

                # Call the method
                result = list(self.postgres_source.mark_schemas_as_deleted())

                # Verify that delete_entity_from_source was called with correct parameters
                mock_delete.assert_called_once()
                call_args = mock_delete.call_args
                self.assertEqual(call_args[1]["entity_type"], DatabaseSchema)
                self.assertEqual(call_args[1]["mark_deleted_entity"], True)
                self.assertEqual(
                    call_args[1]["params"], {"database": "test_service.test_db"}
                )

                # Verify the entity_source_state contains both processed and filtered schemas
                expected_source_state = {
                    "test_schema_fqn",
                    "test_schema_fqn",
                    "another_schema_fqn",
                }
                self.assertEqual(
                    call_args[1]["entity_source_state"], expected_source_state
                )

    def test_mark_deleted_schemas_disabled(self):
        """Test mark deleted schemas when the config is disabled"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedSchemas = False
        self.postgres_source.source_config = mock_source_config

        # Call the method
        result = list(self.postgres_source.mark_schemas_as_deleted())

        # Verify that no deletion operations are performed
        self.assertEqual(result, [])

    def test_mark_deleted_schemas_no_database_context(self):
        """Test mark deleted schemas when no database is in context"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedSchemas = True
        self.postgres_source.source_config = mock_source_config

        # Remove database from context
        self.postgres_source.context.get().__dict__.pop("database", None)

        # Call the method and expect ValueError
        with self.assertRaises(ValueError) as context:
            list(self.postgres_source.mark_schemas_as_deleted())

        self.assertIn("No Database found in the context", str(context.exception))

    def test_mark_deleted_databases_enabled(self):
        """Test mark deleted databases when the config is enabled"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedDatabases = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database service information
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock the database entity source state
        self.postgres_source.database_entity_source_state = {"test_db_fqn"}

        # Mock the _get_filtered_database_names method
        with patch.object(
            self.postgres_source, "_get_filtered_database_names"
        ) as mock_filtered_dbs:
            mock_filtered_dbs.return_value = ["test_db", "another_db"]

            # Mock the delete_entity_from_source function
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                mock_delete.return_value = iter([])

                # Call the method
                result = list(self.postgres_source.mark_databases_as_deleted())

                # Verify that delete_entity_from_source was called with correct parameters
                mock_delete.assert_called_once()
                call_args = mock_delete.call_args
                self.assertEqual(call_args[1]["entity_type"], Database)
                self.assertEqual(call_args[1]["mark_deleted_entity"], True)
                self.assertEqual(call_args[1]["params"], {"service": "test_service"})

                # Verify the entity_source_state contains both processed and filtered databases
                expected_source_state = {
                    "test_db_fqn",
                    "test_service.test_db",
                    "test_service.another_db",
                }
                self.assertEqual(
                    call_args[1]["entity_source_state"], expected_source_state
                )

    def test_mark_deleted_databases_disabled(self):
        """Test mark deleted databases when the config is disabled"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedDatabases = False
        self.postgres_source.source_config = mock_source_config

        # Call the method
        result = list(self.postgres_source.mark_databases_as_deleted())

        # Verify that no deletion operations are performed
        self.assertEqual(result, [])

    def test_mark_deleted_schemas_with_schema_filter_pattern(self):
        """Test mark deleted schemas with schema filter pattern applied"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedSchemas = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database information
        self.postgres_source.context.get().__dict__["database"] = "test_db"
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock the schema entity source state with some existing schemas
        self.postgres_source.schema_entity_source_state = {
            "test_service.test_db.schema1",
            "test_service.test_db.schema2",
        }

        # Mock the _get_filtered_schema_names method to return filtered schemas
        with patch.object(
            self.postgres_source, "_get_filtered_schema_names"
        ) as mock_filtered_schemas:
            mock_filtered_schemas.return_value = ["test_service.test_db.schema1"]

            # Mock the delete_entity_from_source function
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                mock_delete.return_value = iter([])

                # Call the method
                result = list(self.postgres_source.mark_schemas_as_deleted())

                # Verify that delete_entity_from_source was called
                mock_delete.assert_called_once()
                call_args = mock_delete.call_args

                # Verify the entity_source_state contains both processed and filtered schemas
                expected_source_state = {
                    "test_service.test_db.schema1",
                    "test_service.test_db.schema2",
                    "test_service.test_db.schema1",
                }
                self.assertEqual(
                    call_args[1]["entity_source_state"], expected_source_state
                )

    def test_mark_deleted_databases_with_database_filter_pattern(self):
        """Test mark deleted databases with database filter pattern applied"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedDatabases = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database service information
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock the database entity source state with some existing databases
        self.postgres_source.database_entity_source_state = {
            "test_service.db1",
            "test_service.db2",
        }

        # Mock the _get_filtered_database_names method to return filtered databases
        with patch.object(
            self.postgres_source, "_get_filtered_database_names"
        ) as mock_filtered_dbs:
            mock_filtered_dbs.return_value = ["db1"]

            # Mock the delete_entity_from_source function
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                mock_delete.return_value = iter([])

                # Call the method
                result = list(self.postgres_source.mark_databases_as_deleted())

                # Verify that delete_entity_from_source was called
                mock_delete.assert_called_once()
                call_args = mock_delete.call_args

                # Verify the entity_source_state contains both processed and filtered databases
                expected_source_state = {
                    "test_service.db1",
                    "test_service.db2",
                    "test_service.db1",
                }
                self.assertEqual(
                    call_args[1]["entity_source_state"], expected_source_state
                )

    def test_mark_deleted_schemas_empty_source_state(self):
        """Test mark deleted schemas with empty source state"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedSchemas = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database information
        self.postgres_source.context.get().__dict__["database"] = "test_db"
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock empty schema entity source state
        self.postgres_source.schema_entity_source_state = set()

        # Mock the _get_filtered_schema_names method
        with patch.object(
            self.postgres_source, "_get_filtered_schema_names"
        ) as mock_filtered_schemas:
            mock_filtered_schemas.return_value = ["test_service.test_db.schema1"]

            # Mock the delete_entity_from_source function
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                mock_delete.return_value = iter([])

                # Call the method
                result = list(self.postgres_source.mark_schemas_as_deleted())

                # Verify that delete_entity_from_source was called with only filtered schemas
                mock_delete.assert_called_once()
                call_args = mock_delete.call_args
                expected_source_state = {"test_service.test_db.schema1"}
                self.assertEqual(
                    call_args[1]["entity_source_state"], expected_source_state
                )

    def test_mark_deleted_databases_empty_source_state(self):
        """Test mark deleted databases with empty source state"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedDatabases = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database service information
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock empty database entity source state
        self.postgres_source.database_entity_source_state = set()

        # Mock the _get_filtered_database_names method
        with patch.object(
            self.postgres_source, "_get_filtered_database_names"
        ) as mock_filtered_dbs:
            mock_filtered_dbs.return_value = ["db1"]

            # Mock the delete_entity_from_source function
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                mock_delete.return_value = iter([])

                # Call the method
                result = list(self.postgres_source.mark_databases_as_deleted())

                # Verify that delete_entity_from_source was called with only filtered databases
                mock_delete.assert_called_once()
                call_args = mock_delete.call_args
                expected_source_state = {"test_service.db1"}
                self.assertEqual(
                    call_args[1]["entity_source_state"], expected_source_state
                )

    def test_mark_deleted_schemas_exception_handling(self):
        """Test mark deleted schemas exception handling"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedSchemas = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database information
        self.postgres_source.context.get().__dict__["database"] = "test_db"
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock the schema entity source state
        self.postgres_source.schema_entity_source_state = {"test_schema_fqn"}

        # Mock the _get_filtered_schema_names method to raise an exception
        with patch.object(
            self.postgres_source, "_get_filtered_schema_names"
        ) as mock_filtered_schemas:
            mock_filtered_schemas.side_effect = Exception("Test exception")

            # Call the method and expect it to handle the exception gracefully
            with self.assertRaises(Exception):
                list(self.postgres_source.mark_schemas_as_deleted())

    def test_mark_deleted_databases_exception_handling(self):
        """Test mark deleted databases exception handling"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedDatabases = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database service information
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock the database entity source state
        self.postgres_source.database_entity_source_state = {"test_db_fqn"}

        # Mock the _get_filtered_database_names method to raise an exception
        with patch.object(
            self.postgres_source, "_get_filtered_database_names"
        ) as mock_filtered_dbs:
            mock_filtered_dbs.side_effect = Exception("Test exception")

            # Call the method and expect it to handle the exception gracefully
            with self.assertRaises(Exception):
                list(self.postgres_source.mark_databases_as_deleted())

    def test_mark_deleted_schemas_with_multiple_schemas(self):
        """Test mark deleted schemas with multiple schemas in source state"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedSchemas = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database information
        self.postgres_source.context.get().__dict__["database"] = "test_db"
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock the schema entity source state with multiple schemas
        self.postgres_source.schema_entity_source_state = {
            "test_service.test_db.schema1",
            "test_service.test_db.schema2",
            "test_service.test_db.schema3",
        }

        # Mock the _get_filtered_schema_names method
        with patch.object(
            self.postgres_source, "_get_filtered_schema_names"
        ) as mock_filtered_schemas:
            mock_filtered_schemas.return_value = [
                "test_service.test_db.schema1",
                "test_service.test_db.schema2",
            ]

            # Mock the delete_entity_from_source function
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                mock_delete.return_value = iter([])

                # Call the method
                result = list(self.postgres_source.mark_schemas_as_deleted())

                # Verify that delete_entity_from_source was called
                mock_delete.assert_called_once()
                call_args = mock_delete.call_args

                # Verify the entity_source_state contains all schemas
                expected_source_state = {
                    "test_service.test_db.schema1",
                    "test_service.test_db.schema2",
                    "test_service.test_db.schema3",
                    "test_service.test_db.schema1",
                    "test_service.test_db.schema2",
                }
                self.assertEqual(
                    call_args[1]["entity_source_state"], expected_source_state
                )

    def test_mark_deleted_databases_with_multiple_databases(self):
        """Test mark deleted databases with multiple databases in source state"""
        # Create a mock source config with the required attributes
        mock_source_config = MagicMock()
        mock_source_config.markDeletedDatabases = True
        self.postgres_source.source_config = mock_source_config

        # Mock the context to have database service information
        self.postgres_source.context.get().__dict__["database_service"] = "test_service"

        # Mock the database entity source state with multiple databases
        self.postgres_source.database_entity_source_state = {
            "test_service.db1",
            "test_service.db2",
            "test_service.db3",
        }

        # Mock the _get_filtered_database_names method
        with patch.object(
            self.postgres_source, "_get_filtered_database_names"
        ) as mock_filtered_dbs:
            mock_filtered_dbs.return_value = ["db1", "db2"]

            # Mock the delete_entity_from_source function
            with patch(
                "metadata.ingestion.source.database.database_service.delete_entity_from_source"
            ) as mock_delete:
                mock_delete.return_value = iter([])

                # Call the method
                result = list(self.postgres_source.mark_databases_as_deleted())

                # Verify that delete_entity_from_source was called
                mock_delete.assert_called_once()
                call_args = mock_delete.call_args

                # Verify the entity_source_state contains all databases
                expected_source_state = {
                    "test_service.db1",
                    "test_service.db2",
                    "test_service.db3",
                    "test_service.db1",
                    "test_service.db2",
                }
                self.assertEqual(
                    call_args[1]["entity_source_state"], expected_source_state
                )
