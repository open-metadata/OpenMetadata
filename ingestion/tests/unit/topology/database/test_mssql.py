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
Test Mssql using the topology
"""

import types
from unittest import TestCase
from unittest.mock import patch

from sqlalchemy.types import INTEGER, VARCHAR

import metadata.ingestion.source.database.mssql.utils as mssql_dialet
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
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.mssql.metadata import MssqlSource

mock_mssql_config = {
    "source": {
        "type": "mssql",
        "serviceName": "test2",
        "serviceConnection": {
            "config": {
                "type": "Mssql",
                "database": "test_database",
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
            "securityConfig": {"jwtToken": "mssql"},
        }
    },
}

MOCK_DATABASE_SERVICE = DatabaseService(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="mssql_source_test",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Mssql,
)

MOCK_DATABASE = Database(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="sample_database",
    fullyQualifiedName="mssql_source_test.sample_database",
    displayName="sample_database",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
    name="sample.schema",
    fullyQualifiedName="mssql_source_test.sample_database.sample.schema",
    service=EntityReference(id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb", type="database"),
    database=EntityReference(
        id="a58b1856-729c-493b-bc87-6d2269b43ec0",
        type="database",
    ),
)

MOCK_COLUMN_VALUE = [
    {
        "name": "sample_col_1",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "sample_col_2",
        "type": INTEGER(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "int",
        "comment": None,
    },
    {
        "name": "sample_col_3",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "varchar(50)",
        "comment": None,
    },
    {
        "name": "sample_col_4",
        "type": VARCHAR(),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": None,
        "system_data_type": "varchar(50)",
    },
]

EXPECTED_DATABASE = [
    CreateDatabaseRequest(
        name=EntityName("sample_database"),
        displayName=None,
        description=None,
        tags=None,
        owners=None,
        service=FullyQualifiedEntityName("mssql_source_test"),
        dataProducts=None,
        default=False,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        domain=None,
        lifeCycle=None,
        sourceHash=None,
    )
]

EXPECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName("sample.schema"),
        displayName=None,
        description=None,
        owners=None,
        database=FullyQualifiedEntityName("mssql_source_test.sample_database"),
        dataProducts=None,
        tags=None,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        domain=None,
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
                name=ColumnName("sample_col_1"),
                displayName=None,
                dataType=DataType.VARCHAR.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="varchar(50)",
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
                name=ColumnName("sample_col_2"),
                displayName=None,
                dataType=DataType.INT.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="int",
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
                name=ColumnName("sample_col_3"),
                displayName=None,
                dataType=DataType.VARCHAR.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="varchar(50)",
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
                name=ColumnName("sample_col_4"),
                displayName=None,
                dataType=DataType.VARCHAR.name,
                arrayDataType=None,
                dataLength=1,
                precision=None,
                scale=None,
                dataTypeDisplay="varchar(50)",
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
        databaseSchema=FullyQualifiedEntityName(
            'mssql_source_test.sample_database."sample.schema"'
        ),
        tags=None,
        schemaDefinition=None,
        retentionPeriod=None,
        extension=None,
        sourceUrl=None,
        domain=None,
        dataProducts=None,
        fileFormat=None,
        lifeCycle=None,
        sourceHash=None,
    )
]


class MssqlUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Mssql Unit Test
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
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_mssql_config)
        self.mssql = MssqlSource.create(
            mock_mssql_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.mssql.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.thread_id = self.mssql.context.get_current_thread_id()
        self.mssql._inspector_map[self.thread_id] = types.SimpleNamespace()
        self.mssql._inspector_map[
            self.thread_id
        ].get_columns = (
            lambda table_name, schema_name, table_type, db_name: MOCK_COLUMN_VALUE
        )
        self.mssql._inspector_map[
            self.thread_id
        ].get_pk_constraint = lambda table_name, schema_name: []
        self.mssql._inspector_map[
            self.thread_id
        ].get_unique_constraints = lambda table_name, schema_name: []
        self.mssql._inspector_map[
            self.thread_id
        ].get_foreign_keys = lambda table_name, schema_name: []

    def test_yield_database(self):
        assert EXPECTED_DATABASE == [
            either.right
            for either in self.mssql.yield_database(MOCK_DATABASE.name.root)
        ]

        self.mssql.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.mssql.context.get().__dict__["database"] = MOCK_DATABASE.name.root

    @mssql_dialet.db_plus_owner
    def mock_function(
        self, connection, tablename, dbname, owner, schema, **kw
    ):  # pylint: disable=unused-argument
        # Mock function for testing
        return schema

    def test_schema_with_dot(self):
        # Test when the schema contains a dot
        result = self.mock_function(  # pylint: disable=no-value-for-parameter
            "mock_dialect",
            "mock_connection",
            "your.schema",
        )
        self.assertEqual(result, "[your.schema]")

    def test_yield_schema(self):
        assert EXPECTED_DATABASE_SCHEMA == [
            either.right
            for either in self.mssql.yield_database_schema(
                model_str(MOCK_DATABASE_SCHEMA.name)
            )
        ]

        self.mssql.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    def test_yield_table(self):
        assert EXPECTED_TABLE == [
            either.right
            for either in self.mssql.yield_table(("sample_table", "Regular"))
        ]
