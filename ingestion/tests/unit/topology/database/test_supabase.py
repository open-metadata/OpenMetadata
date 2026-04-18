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
Unit tests for the Supabase connector.
"""

import types
from unittest import TestCase
from unittest.mock import patch

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
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.database.supabase.metadata import SupabaseSource
from metadata.ingestion.source.database.supabase.queries import SUPABASE_SYSTEM_SCHEMAS

mock_supabase_config = {
    "source": {
        "type": "supabase",
        "serviceName": "local_supabase",
        "serviceConnection": {
            "config": {
                "type": "Supabase",
                "username": "postgres",
                "authType": {
                    "password": "my-super-secret-supabase-password",
                },
                "hostPort": "db.abcdefghijklmnop.supabase.co:5432",
                "database": "postgres",
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
            "securityConfig": {"jwtToken": "supabase_test_token"},
        }
    },
}

mock_supabase_config_with_pooler = {
    "source": {
        "type": "supabase",
        "serviceName": "local_supabase_pooler",
        "serviceConnection": {
            "config": {
                "type": "Supabase",
                "username": "postgres",
                "authType": {
                    "password": "my-super-secret-supabase-password",
                },
                "hostPort": "aws-0-us-east-1.pooler.supabase.com:6543",
                "database": "postgres",
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
            "securityConfig": {"jwtToken": "supabase_test_token"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="b1a2c3d4-e5f6-7890-abcd-ef1234567890",
    name="supabase_service",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Supabase,
)

MOCK_DATABASE = Database(
    id="a1b2c3d4-e5f6-7890-abcd-ef1234567891",
    name="postgres",
    fullyQualifiedName="supabase_service.postgres",
    displayName="postgres",
    description="",
    service=EntityReference(
        id="b1a2c3d4-e5f6-7890-abcd-ef1234567890",
        type="databaseService",
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c1d2e3f4-a5b6-7890-abcd-ef1234567892",
    name="public",
    fullyQualifiedName="supabase_service.postgres.public",
    displayName="public",
    description="",
    database=EntityReference(
        id="a1b2c3d4-e5f6-7890-abcd-ef1234567891",
        type="database",
    ),
    service=EntityReference(
        id="b1a2c3d4-e5f6-7890-abcd-ef1234567890",
        type="databaseService",
    ),
)

MOCK_COLUMN_VALUE = [
    {
        "name": "id",
        "type": VARCHAR(),
        "nullable": False,
        "default": None,
        "autoincrement": True,
        "system_data_type": "uuid",
        "comment": None,
    },
    {
        "name": "email",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(255)",
        "comment": None,
    },
]

EXPECTED_COLUMN_VALUE = [
    Column(
        name="id",
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="uuid",
        description=None,
        fullyQualifiedName=None,
        tags=None,
        constraint=Constraint.NOT_NULL,
        ordinalPosition=None,
        jsonSchema=None,
        children=None,
        customMetrics=None,
        profile=None,
    ),
    Column(
        name="email",
        displayName=None,
        dataType=DataType.VARCHAR,
        arrayDataType=None,
        dataLength=1,
        precision=None,
        scale=None,
        dataTypeDisplay="varchar(255)",
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


class SupabaseUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_supabase_config)
        self.supabase_source = SupabaseSource.create(
            mock_supabase_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.supabase_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.supabase_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.root
        self.supabase_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.supabase_source.close()

    def test_create_with_invalid_connection_raises(self):
        """SupabaseSource.create() must reject non-Supabase connection configs."""
        bad_config = {
            "type": "postgres",
            "serviceName": "wrong_service",
            "serviceConnection": {
                "config": {
                    "type": "Postgres",
                    "username": "postgres",
                    "authType": {"password": "pass"},
                    "hostPort": "localhost:5432",
                    "database": "mydb",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }
        with self.assertRaises(Exception):
            SupabaseSource.create(
                bad_config,
                self.config.workflowConfig.openMetadataServerConfig,
            )

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def test_create_with_pooler_host(self, test_connection):
        """SupabaseSource should be created successfully with a PgBouncer pooler hostPort."""
        test_connection.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(
            mock_supabase_config_with_pooler
        )
        source = SupabaseSource.create(
            mock_supabase_config_with_pooler["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        assert source is not None
        assert (
            source.service_connection.hostPort
            == "aws-0-us-east-1.pooler.supabase.com:6543"
        )

    def test_system_schemas_defined(self):
        """Supabase system schemas list must include all known internal schemas."""
        expected_system_schemas = {
            "auth",
            "storage",
            "realtime",
            "extensions",
            "graphql",
            "graphql_public",
            "supabase_functions",
            "supabase_migrations",
        }
        for schema in expected_system_schemas:
            assert schema in SUPABASE_SYSTEM_SCHEMAS, (
                f"Expected system schema '{schema}' not found in SUPABASE_SYSTEM_SCHEMAS"
            )

    def test_datatype_extraction(self):
        """Columns should be correctly mapped from SQLAlchemy types to OpenMetadata DataType."""
        inspector = types.SimpleNamespace()
        inspector.get_columns = (
            lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        )
        inspector.get_pk_constraint = lambda table_name, schema_name: {}
        inspector.get_unique_constraints = lambda table_name, schema_name: []
        inspector.get_foreign_keys = lambda table_name, schema_name: []

        result, _, _ = self.supabase_source.get_columns_and_constraints(
            "public", "users", "postgres", inspector, TableType.Regular
        )

        assert len(result) == len(EXPECTED_COLUMN_VALUE)
        for i, expected in enumerate(EXPECTED_COLUMN_VALUE):
            assert result[i].name == expected.name
            assert result[i].dataType == expected.dataType

    def test_service_type_is_supabase(self):
        """The service connection type must be Supabase."""
        from metadata.generated.schema.entity.services.connections.database.supabaseConnection import (
            SupabaseConnection,
        )
        assert isinstance(
            self.supabase_source.service_connection, SupabaseConnection
        )

    def test_system_schemas_are_filtered(self):
        """get_schema_names must exclude all Supabase system schemas."""
        all_schemas = [
            "public",
            "auth",
            "storage",
            "realtime",
            "extensions",
            "graphql",
            "graphql_public",
            "supabase_functions",
            "supabase_migrations",
            "pg_catalog",
            "information_schema",
            "myapp",
        ]
        mock_inspector = types.SimpleNamespace()
        mock_inspector.get_schema_names = lambda: all_schemas

        with patch.object(
            type(self.supabase_source), "inspector", new_callable=lambda: property(lambda self: mock_inspector)
        ):
            result = list(self.supabase_source.get_schema_names())

        assert result == ["public", "myapp"]
