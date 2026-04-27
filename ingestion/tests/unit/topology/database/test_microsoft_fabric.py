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
Test Microsoft Fabric Database connector using the topology
"""

import types
from unittest import TestCase
from unittest.mock import MagicMock, patch

from sqlalchemy.types import INTEGER, VARCHAR

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
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
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.microsoftfabric.metadata import (
    MicrosoftFabricSource,
)

mock_fabric_config = {
    "source": {
        "type": "microsoftfabric",
        "serviceName": "test_fabric_service",
        "serviceConnection": {
            "config": {
                "type": "MicrosoftFabric",
                "tenantId": "test-tenant-id",
                "clientId": "test-client-id",
                "clientSecret": "test-client-secret",
                "hostPort": "test.datawarehouse.fabric.microsoft.com",
                "database": "test_warehouse",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "fabric"},
        }
    },
}

mock_fabric_ingest_all_config = {
    "source": {
        "type": "microsoftfabric",
        "serviceName": "test_fabric_all",
        "serviceConnection": {
            "config": {
                "type": "MicrosoftFabric",
                "tenantId": "test-tenant-id",
                "clientId": "test-client-id",
                "clientSecret": "test-client-secret",
                "hostPort": "test.datawarehouse.fabric.microsoft.com",
                "ingestAllDatabases": True,
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "fabric"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="test_fabric_service",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.MicrosoftFabric,
)

MOCK_DATABASE = Database(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="test_warehouse",
    fullyQualifiedName="test_fabric_service.test_warehouse",
    displayName="test_warehouse",
    description="",
    service=EntityReference(id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="dbo",
    fullyQualifiedName="test_fabric_service.test_warehouse.dbo",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="database"),
    database=EntityReference(
        id="a58b1856-729c-493b-bc87-6d2269b43ec0",
        type="database",
    ),
)

MOCK_COLUMN_VALUE = [
    {
        "name": "id",
        "type": INTEGER(),
        "nullable": False,
        "default": None,
        "autoincrement": False,
        "system_data_type": "int",
        "comment": "Primary key",
    },
    {
        "name": "name",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(255)",
        "comment": None,
    },
    {
        "name": "description",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(max)",
        "comment": None,
    },
]

EXPECTED_DATABASE = [
    CreateDatabaseRequest(
        name=EntityName("test_warehouse"),
        displayName=None,
        description=None,
        tags=None,
        owners=None,
        service=FullyQualifiedEntityName("test_fabric_service"),
        dataProducts=None,
        default=False,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        lifeCycle=None,
        sourceHash=None,
    )
]

EXPECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName("dbo"),
        displayName=None,
        description=None,
        owners=None,
        database=FullyQualifiedEntityName("test_fabric_service.test_warehouse"),
        dataProducts=None,
        tags=None,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        lifeCycle=None,
        sourceHash=None,
    )
]

EXPECTED_TABLE = [
    CreateTableRequest(
        name=EntityName("sample_table"),
        displayName=None,
        description=None,
        tableType=TableType.Regular.name,
        columns=[
            Column(
                name=ColumnName("id"),
                displayName=None,
                dataType=DataType.INT.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="int",
                description="Primary key",
                fullyQualifiedName=None,
                tags=None,
                constraint="NOT_NULL",
                ordinalPosition=None,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName("name"),
                displayName=None,
                dataType=DataType.VARCHAR.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="varchar(255)",
                description=None,
                fullyQualifiedName=None,
                tags=None,
                constraint="NULL",
                ordinalPosition=None,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
            Column(
                name=ColumnName("description"),
                displayName=None,
                dataType=DataType.VARCHAR.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="varchar(max)",
                description=None,
                fullyQualifiedName=None,
                tags=None,
                constraint="NULL",
                ordinalPosition=None,
                jsonSchema=None,
                children=None,
                profile=None,
                customMetrics=None,
            ),
        ],
        tableConstraints=[],
        tablePartition=None,
        tableProfilerConfig=None,
        owners=None,
        databaseSchema=FullyQualifiedEntityName("test_fabric_service.test_warehouse.dbo"),
        tags=None,
        schemaDefinition=None,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        dataProducts=None,
        fileFormat=None,
        lifeCycle=None,
        sourceHash=None,
    )
]


class MicrosoftFabricUnitTest(TestCase):
    """
    Unit tests for Microsoft Fabric Database connector
    """

    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    @patch("metadata.ingestion.source.database.microsoftfabric.connection.get_connection")
    def __init__(
        self,
        methodName,
        mock_get_connection,
        test_connection,
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        mock_get_connection.return_value = MagicMock()

        self.config = OpenMetadataWorkflowConfig.model_validate(mock_fabric_config)
        self.fabric_source = MicrosoftFabricSource.create(
            mock_fabric_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.fabric_source.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        self.thread_id = self.fabric_source.context.get_current_thread_id()
        self.fabric_source._inspector_map[self.thread_id] = types.SimpleNamespace()
        self.fabric_source._inspector_map[self.thread_id].get_columns = (
            lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        )
        self.fabric_source._inspector_map[self.thread_id].get_pk_constraint = lambda table_name, schema_name: []
        self.fabric_source._inspector_map[self.thread_id].get_unique_constraints = lambda table_name, schema_name: []
        self.fabric_source._inspector_map[self.thread_id].get_foreign_keys = lambda table_name, schema_name: []

    def test_yield_database(self):
        """Test database yielding"""
        results = [either.right for either in self.fabric_source.yield_database(MOCK_DATABASE.name.root)]
        self.assertEqual(EXPECTED_DATABASE, results)

        self.fabric_source.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        self.fabric_source.context.get().__dict__["database"] = MOCK_DATABASE.name.root

    def test_yield_schema(self):
        """Test schema yielding"""
        self.fabric_source.context.get().__dict__["database"] = MOCK_DATABASE.name.root

        results = [either.right for either in self.fabric_source.yield_database_schema(MOCK_DATABASE_SCHEMA.name.root)]
        self.assertEqual(EXPECTED_DATABASE_SCHEMA, results)

        self.fabric_source.context.get().__dict__["database_schema"] = MOCK_DATABASE_SCHEMA.name.root

    def test_yield_table(self):
        """Test table yielding"""
        self.fabric_source.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.fabric_source.context.get().__dict__["database_schema"] = MOCK_DATABASE_SCHEMA.name.root

        results = [either.right for either in self.fabric_source.yield_table(("sample_table", "Regular"))]
        self.assertEqual(EXPECTED_TABLE, results)


class MicrosoftFabricConnectionTest(TestCase):
    """
    Unit tests for Microsoft Fabric connection URL generation
    """

    def test_connection_url_generation(self):
        """Test that connection URL is generated correctly"""
        from metadata.generated.schema.entity.services.connections.database.microsoftFabricConnection import (
            MicrosoftFabricConnection,
        )
        from metadata.ingestion.models.custom_pydantic import CustomSecretStr
        from metadata.ingestion.source.database.microsoftfabric.connection import (
            get_connection_url,
        )

        config = MicrosoftFabricConnection(
            tenantId="test-tenant-id",
            clientId="test-client-id",
            clientSecret=CustomSecretStr("test-client-secret"),
            hostPort="test.datawarehouse.fabric.microsoft.com",
            database="test_warehouse",
            driver="ODBC Driver 18 for SQL Server",
        )

        connection_url = get_connection_url(config)
        connection_string = connection_url.query.get("odbc_connect")

        # Verify connection string contains expected parameters
        self.assertIn("Driver={ODBC Driver 18 for SQL Server}", connection_string)
        self.assertIn("Server=test.datawarehouse.fabric.microsoft.com", connection_string)
        self.assertIn("Database=test_warehouse", connection_string)
        self.assertIn("Encrypt=yes", connection_string)

    def test_connection_url_without_database(self):
        """Test connection URL generation without specific database"""
        from metadata.generated.schema.entity.services.connections.database.microsoftFabricConnection import (
            MicrosoftFabricConnection,
        )
        from metadata.ingestion.models.custom_pydantic import CustomSecretStr
        from metadata.ingestion.source.database.microsoftfabric.connection import (
            get_connection_url,
        )

        config = MicrosoftFabricConnection(
            tenantId="test-tenant-id",
            clientId="test-client-id",
            clientSecret=CustomSecretStr("test-client-secret"),
            hostPort="test.datawarehouse.fabric.microsoft.com",
        )

        connection_url = get_connection_url(config)
        connection_string = connection_url.query.get("odbc_connect")

        # Should not have Database parameter when not specified
        self.assertIn("Server=test.datawarehouse.fabric.microsoft.com", connection_string)
