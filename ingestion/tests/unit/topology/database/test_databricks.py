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
Test databricks using the topology
"""

from unittest import TestCase
from unittest.mock import MagicMock, Mock, patch

from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataType, TableType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.databricks.metadata import DatabricksSource

# pylint: disable=line-too-long
mock_databricks_config = {
    "source": {
        "type": "databricks",
        "serviceName": "local_datalake",
        "serviceConnection": {
            "config": {
                "type": "Databricks",
                "catalog": "hive_metastore",
                "databaseSchema": "default",
                "token": "123sawdtesttoken",
                "hostPort": "localhost:443",
                "httpPath": "/sql/1.0/warehouses/abcdedfg",
                "connectionArguments": {"http_path": "/sql/1.0/warehouses/abcdedfg"},
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "schemaFilterPattern": {"excludes": []},
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "databricks"},
        }
    },
}


MOCK_TABLE = {
    "id": "2d725b6e-1588-4814-9d8b-eff384cd1053",
    "name": "DataSet Input",
    "description": "this is a description for dataset input",
    "rows": 99,
    "columns": 10,
    "schema": {
        "columns": [
            {"type": "DOUBLE", "name": "amount"},
            {"type": "DOUBLE", "name": "bank_transfer_amount"},
            {"type": "DOUBLE", "name": "coupon_amount"},
            {"type": "DOUBLE", "name": "credit_card_amount"},
        ]
    },
    "owner": {"id": 1027954122, "name": "Nihar Doshi"},
    "dataCurrentAt": "2022-10-18T05:30:06Z",
    "createdAt": "2022-10-17T05:52:21Z",
    "updatedAt": "2022-10-18T05:30:07Z",
    "pdpEnabled": False,
    "policies": [
        {
            "id": 17,
            "type": "open",
            "name": "All Rows",
            "filters": [],
            "users": [],
            "virtualUsers": [],
            "groups": [],
        }
    ],
}

MOCK_TABLE_2 = {
    "id": "3df43ed7-5f2f-46bb-9793-384c6374a81d",
    "name": "growth data",
    "description": "company growth data",
    "rows": 5,
    "columns": 2,
    "schema": {
        "columns": [
            {"type": "ARRAY", "name": "quarters.result"},
            {"type": "NUMBER", "name": "profit"},
        ]
    },
    "owner": {"id": 6024954162, "name": "Sam"},
    "dataCurrentAt": "2024-07-15T05:30:06Z",
    "createdAt": "2024-07-15T05:52:21Z",
    "updatedAt": "2024-07-15T05:30:07Z",
}

EXPTECTED_TABLE_2 = [
    CreateTableRequest(
        name="growth data",
        displayName="growth data",
        description="company growth data",
        tableType=TableType.Regular.value,
        columns=[
            Column(
                name="quarters.result",
                dataType=DataType.ARRAY.value,
            ),
            Column(
                name="profit",
                dataType=DataType.NUMBER.value,
            ),
        ],
        databaseSchema=FullyQualifiedEntityName(
            "local_databricks.hive_metastore.do_it_all_with_default_schema"
        ),
    )
]

EXPECTED_DATABASE_NAMES = ["hive_metastore"]
EXPECTED_DATABASE_SCHEMA_NAMES = ["default"]

MOCK_DATABASE_SERVICE = DatabaseService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="local_databricks",
    connection=DatabaseConnection(),
    serviceType=DatabaseServiceType.Databricks,
)

MOCK_DATABASE = Database(
    id="a4e2f4aa-10af-4d4b-a85b-5daad6f70720",
    name="hive_metastore",
    fullyQualifiedName="local_databricks.hive_metastore",
    displayName="hive_metastore",
    description="",
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"
    ),
)

MOCK_DATABASE_SCHEMA = DatabaseSchema(
    id="ec5be98f-917c-44be-b178-47b3237ef648",
    name="do_it_all_with_default_schema",
    fullyQualifiedName="domodatabase_source.do_it_all_with_default_config.do_it_all_with_default_schema",
    service=EntityReference(id="ec5be98f-917c-44be-b178-47b3237ef648", type="database"),
    database=EntityReference(
        id="a4e2f4aa-10af-4d4b-a85b-5daad6f70720",
        type="database",
    ),
)


EXPTECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name="do_it_all_with_default_schema",
        displayName=None,
        description=None,
        owners=None,
        database="local_databricks.hive_metastore",
    )
]


EXPTECTED_TABLE = [
    CreateTableRequest(
        name="newtable",
        displayName="newtable",
        description="this is a description for dataset input",
        tableType=TableType.Regular.value,
        columns=[
            Column(
                name="amount",
                displayName=None,
                dataType=DataType.DOUBLE.value,
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay=None,
                description="",
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=1,
                jsonSchema=None,
                children=None,
                customMetrics=None,
                profile=None,
            ),
            Column(
                name="bank_transfer_amount",
                displayName=None,
                dataType=DataType.DOUBLE.value,
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay=None,
                description="",
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=2,
                jsonSchema=None,
                children=None,
                customMetrics=None,
                profile=None,
            ),
            Column(
                name="coupon_amount",
                displayName=None,
                dataType=DataType.DOUBLE.value,
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay=None,
                description="",
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=3,
                jsonSchema=None,
                children=None,
                customMetrics=None,
                profile=None,
            ),
            Column(
                name="credit_card_amount",
                displayName=None,
                dataType=DataType.DOUBLE.value,
                arrayDataType=None,
                dataLength=None,
                precision=None,
                scale=None,
                dataTypeDisplay=None,
                description="",
                fullyQualifiedName=None,
                tags=None,
                constraint=None,
                ordinalPosition=4,
                jsonSchema=None,
                children=None,
                customMetrics=None,
                profile=None,
            ),
        ],
        tableConstraints=None,
        tablePartition=None,
        tableProfilerConfig=None,
        owners=None,
        databaseSchema=FullyQualifiedEntityName(
            "local_databricks.hive_metastore.do_it_all_with_default_schema"
        ),
        tags=None,
        schemaDefinition=None,
        extension=None,
    )
]


class DatabricksUnitTest(TestCase):
    """
    Databricks unit tests
    """

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    @patch(
        "metadata.ingestion.source.database.databricks.metadata.DatabricksSource._init_version"
    )
    def __init__(self, methodName, test_connection, db_init_version) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        db_init_version.return_value = None

        self.config = OpenMetadataWorkflowConfig.model_validate(mock_databricks_config)
        self.databricks_source = DatabricksSource.create(
            mock_databricks_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.databricks_source.context.get().__dict__[
            "database"
        ] = MOCK_DATABASE.name.root
        self.databricks_source.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root

        self.databricks_source.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

    def test_database_schema_names(self):
        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
            self.databricks_source.get_database_schema_names()
        )

    def test_raw_database_schema_names(self):
        assert EXPECTED_DATABASE_SCHEMA_NAMES == list(
            self.databricks_source.get_raw_database_schema_names()
        )

    def test_yield_schema(self):
        schema_list = []
        yield_schemas = self.databricks_source.yield_database_schema(
            schema_name=model_str(MOCK_DATABASE_SCHEMA.name)
        )

        for schema in yield_schemas:
            if isinstance(schema, CreateDatabaseSchemaRequest):
                schema_list.append(schema)

        for _, (exptected, original) in enumerate(
            zip(EXPTECTED_DATABASE_SCHEMA, schema_list)
        ):
            self.assertEqual(exptected, original)

    def test_yield_table(self):
        table_list = []
        yield_tables = self.databricks_source.yield_table(
            ("2d725b6e-1588-4814-9d8b-eff384cd1053", "Regular")
        )

        for table in yield_tables:
            if isinstance(table, CreateTableRequest):
                table_list.append(table)

        for _, (expected, original) in enumerate(zip(EXPTECTED_TABLE, table_list)):
            self.assertEqual(expected, original)

    def test_yield_table_2(self):
        table_list = []
        yield_tables = self.databricks_source.yield_table(
            ("3df43ed7-5f2f-46bb-9793-384c6374a81d", "Regular")
        )

        for table in yield_tables:
            if isinstance(table, CreateTableRequest):
                table_list.append(table)

        for _, (expected, original) in enumerate(zip(EXPTECTED_TABLE_2, table_list)):
            self.assertEqual(expected, original)


class DatabricksConnectionTest(TestCase):
    """
    Unit tests for Databricks connection functionality
    """

    def setUp(self):
        """Set up test fixtures"""
        from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
            DatabricksConnection,
            DatabricksScheme,
        )
        from metadata.ingestion.source.database.databricks.connection import (
            DatabricksEngineWrapper,
            get_connection,
            get_connection_url,
            test_connection,
        )

        self.DatabricksEngineWrapper = DatabricksEngineWrapper
        self.get_connection_url = get_connection_url
        self.get_connection = get_connection
        self.test_connection = test_connection
        self.DatabricksConnection = DatabricksConnection
        self.DatabricksScheme = DatabricksScheme

    def test_get_connection_url(self):
        """Test get_connection_url function"""
        connection = self.DatabricksConnection(
            scheme=self.DatabricksScheme.databricks_connector,
            hostPort="test-host:443",
            token="test-token",
            httpPath="/sql/1.0/warehouses/test",
        )

        url = self.get_connection_url(connection)
        expected_url = "databricks+connector://token:test-token@test-host:443"
        self.assertEqual(url, expected_url)

    @patch(
        "metadata.ingestion.source.database.databricks.connection.create_generic_db_connection"
    )
    def test_get_connection(self, mock_create_connection):
        """Test get_connection function"""
        connection = self.DatabricksConnection(
            scheme=self.DatabricksScheme.databricks_connector,
            hostPort="test-host:443",
            token="test-token",
            httpPath="/sql/1.0/warehouses/test",
        )

        mock_engine = Mock()
        mock_create_connection.return_value = mock_engine

        result = self.get_connection(connection)

        self.assertEqual(result, mock_engine)
        mock_create_connection.assert_called_once()

    def test_databricks_engine_wrapper_initialization(self):
        """Test DatabricksEngineWrapper initialization"""
        mock_engine = Mock()
        mock_inspector = Mock()

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)

            self.assertEqual(wrapper.engine, mock_engine)
            self.assertEqual(wrapper.inspector, mock_inspector)
            self.assertIsNone(wrapper.schemas)
            self.assertIsNone(wrapper.first_schema)

    def test_databricks_engine_wrapper_get_schemas_with_non_system_schemas(self):
        """Test get_schemas with non-system schemas"""
        mock_engine = Mock()
        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = [
            "information_schema",
            "test_schema",
            "performance_schema",
        ]

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            schemas = wrapper.get_schemas()

            self.assertEqual(
                schemas, ["information_schema", "test_schema", "performance_schema"]
            )
            self.assertEqual(wrapper.first_schema, "test_schema")
            self.assertEqual(
                wrapper.schemas,
                ["information_schema", "test_schema", "performance_schema"],
            )

    def test_databricks_engine_wrapper_get_schemas_with_only_system_schemas(self):
        """Test get_schemas with only system schemas"""
        mock_engine = Mock()
        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = [
            "information_schema",
            "performance_schema",
        ]

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            schemas = wrapper.get_schemas()

            self.assertEqual(schemas, ["information_schema", "performance_schema"])
            self.assertEqual(wrapper.first_schema, "information_schema")
            self.assertEqual(
                wrapper.schemas, ["information_schema", "performance_schema"]
            )

    def test_databricks_engine_wrapper_get_schemas_empty(self):
        """Test get_schemas with empty schema list"""
        mock_engine = Mock()
        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = []

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            schemas = wrapper.get_schemas()

            self.assertEqual(schemas, [])
            self.assertIsNone(wrapper.first_schema)
            self.assertEqual(wrapper.schemas, [])

    def test_databricks_engine_wrapper_get_tables_with_cached_schema(self):
        """Test get_tables with cached schema"""
        mock_engine = Mock()
        mock_connection = Mock()
        mock_context_manager = MagicMock()
        mock_context_manager.__enter__.return_value = mock_connection
        mock_context_manager.__exit__.return_value = None
        mock_engine.connect.return_value = mock_context_manager

        # Mock the connection execute method to return a result
        mock_result = Mock()
        mock_result.fetchall.return_value = [("table1",), ("table2",)]
        mock_connection.execute.return_value = mock_result

        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = [
            "test_schema",
            "information_schema",
        ]

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            # Set the first_catalog for the wrapper
            wrapper.first_catalog = "test_catalog"
            # First call to get_schemas to set first_schema
            wrapper.get_schemas()
            # Then call get_tables
            tables = wrapper.get_tables()

            self.assertEqual(tables, mock_result)
            mock_connection.execute.assert_called_once()

    def test_databricks_engine_wrapper_get_tables_without_cached_schema(self):
        """Test get_tables without cached schema"""
        mock_engine = Mock()
        mock_connection = Mock()
        mock_context_manager = MagicMock()
        mock_context_manager.__enter__.return_value = mock_connection
        mock_context_manager.__exit__.return_value = None
        mock_engine.connect.return_value = mock_context_manager

        # Mock the connection execute method to return a result
        mock_result = Mock()
        mock_result.fetchall.return_value = [("table1",), ("table2",)]
        mock_connection.execute.return_value = mock_result

        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = [
            "test_schema",
            "information_schema",
        ]

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            # Set the first_catalog for the wrapper
            wrapper.first_catalog = "test_catalog"
            # Call get_tables directly without calling get_schemas first
            tables = wrapper.get_tables()

            self.assertEqual(tables, mock_result)
            # Should have called get_schemas internally
            mock_inspector.get_schema_names.assert_called_once()
            mock_connection.execute.assert_called_once()

    def test_databricks_engine_wrapper_get_tables_no_schemas(self):
        """Test get_tables when no schemas are available"""
        mock_engine = Mock()
        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = []

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            tables = wrapper.get_tables()

            self.assertEqual(tables, [])
            mock_inspector.get_table_names.assert_not_called()

    def test_databricks_engine_wrapper_get_views_with_cached_schema(self):
        """Test get_views with cached schema"""
        mock_engine = Mock()
        mock_connection = Mock()
        mock_context_manager = MagicMock()
        mock_context_manager.__enter__.return_value = mock_connection
        mock_context_manager.__exit__.return_value = None
        mock_engine.connect.return_value = mock_context_manager

        # Mock the connection execute method to return a result
        mock_result = Mock()
        mock_result.fetchall.return_value = [("view1",), ("view2",)]
        mock_connection.execute.return_value = mock_result

        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = [
            "test_schema",
            "information_schema",
        ]

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            # Set the first_catalog for the wrapper
            wrapper.first_catalog = "test_catalog"
            # First call to get_schemas to set first_schema
            wrapper.get_schemas()
            # Then call get_views
            views = wrapper.get_views()

            self.assertEqual(views, mock_result)
            mock_connection.execute.assert_called_once()

    def test_databricks_engine_wrapper_get_views_without_cached_schema(self):
        """Test get_views without cached schema"""
        mock_engine = Mock()
        mock_connection = Mock()
        mock_context_manager = MagicMock()
        mock_context_manager.__enter__.return_value = mock_connection
        mock_context_manager.__exit__.return_value = None
        mock_engine.connect.return_value = mock_context_manager

        # Mock the connection execute method to return a result
        mock_result = Mock()
        mock_result.fetchall.return_value = [("view1",), ("view2",)]
        mock_connection.execute.return_value = mock_result

        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = [
            "test_schema",
            "information_schema",
        ]

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            # Set the first_catalog for the wrapper
            wrapper.first_catalog = "test_catalog"
            # Call get_views directly without calling get_schemas first
            views = wrapper.get_views()

            self.assertEqual(views, mock_result)
            # Should have called get_schemas internally
            mock_inspector.get_schema_names.assert_called_once()
            mock_connection.execute.assert_called_once()

    def test_databricks_engine_wrapper_get_views_no_schemas(self):
        """Test get_views when no schemas are available"""
        mock_engine = Mock()
        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = []

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            views = wrapper.get_views()

            self.assertEqual(views, [])
            mock_inspector.get_view_names.assert_not_called()

    def test_databricks_engine_wrapper_caching_behavior(self):
        """Test that schemas are cached and not fetched multiple times"""
        mock_engine = Mock()
        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = [
            "test_schema",
            "information_schema",
        ]

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)

            # Call get_schemas multiple times
            schemas1 = wrapper.get_schemas()
            schemas2 = wrapper.get_schemas()
            schemas3 = wrapper.get_schemas()

            # All calls should return the same result
            self.assertEqual(schemas1, schemas2)
            self.assertEqual(schemas2, schemas3)

            # get_schema_names should only be called once due to caching
            mock_inspector.get_schema_names.assert_called_once()

    @patch(
        "metadata.ingestion.source.database.databricks.connection.test_connection_steps"
    )
    def test_test_connection_function(self, mock_test_connection_steps):
        """Test the test_connection function"""
        from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
            DatabricksConnection,
            DatabricksScheme,
        )
        from metadata.generated.schema.entity.services.connections.testConnectionResult import (
            StatusType,
            TestConnectionResult,
            TestConnectionStepResult,
        )

        # Mock the test connection result
        mock_result = TestConnectionResult(
            status=StatusType.Successful,
            steps=[
                TestConnectionStepResult(
                    name="CheckAccess",
                    mandatory=True,
                    passed=True,
                ),
                TestConnectionStepResult(
                    name="GetSchemas",
                    mandatory=True,
                    passed=True,
                ),
                TestConnectionStepResult(
                    name="GetTables",
                    mandatory=True,
                    passed=True,
                ),
                TestConnectionStepResult(
                    name="GetViews",
                    mandatory=False,
                    passed=True,
                ),
            ],
        )
        mock_test_connection_steps.return_value = mock_result

        # Create test connection
        service_connection = DatabricksConnection(
            scheme=DatabricksScheme.databricks_connector,
            hostPort="test-host:443",
            token="test-token",
            httpPath="/sql/1.0/warehouses/test",
            queryHistoryTable="test_table",
        )

        mock_engine = Mock()
        mock_metadata = Mock()

        # Test the function
        result = self.test_connection(
            metadata=mock_metadata,
            connection=mock_engine,
            service_connection=service_connection,
        )

        # Verify the result
        self.assertEqual(result, mock_result)
        mock_test_connection_steps.assert_called_once()

        # Verify the test_fn dictionary was created with the correct functions
        call_args = mock_test_connection_steps.call_args
        test_fn = call_args[1]["test_fn"]

        # Check that the test_fn contains the expected keys
        expected_keys = [
            "CheckAccess",
            "GetSchemas",
            "GetTables",
            "GetViews",
            "GetDatabases",
            "GetQueries",
        ]
        for key in expected_keys:
            self.assertIn(key, test_fn)
            self.assertIsNotNone(test_fn[key])

    def test_databricks_engine_wrapper_system_schema_filtering(self):
        """Test that system schemas are properly filtered out"""
        mock_engine = Mock()
        mock_inspector = Mock()
        # Test with various system schema names
        mock_inspector.get_schema_names.return_value = [
            "information_schema",
            "performance_schema",
            "sys",
            "SYS",
            "INFORMATION_SCHEMA",
            "user_schema",
            "test_schema",
        ]

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            schemas = wrapper.get_schemas()

            # Should return all schemas
            self.assertEqual(
                schemas,
                [
                    "information_schema",
                    "performance_schema",
                    "sys",
                    "SYS",
                    "INFORMATION_SCHEMA",
                    "user_schema",
                    "test_schema",
                ],
            )
            # Should select the first non-system schema (user_schema)
            self.assertEqual(wrapper.first_schema, "user_schema")

    def test_databricks_engine_wrapper_all_system_schemas(self):
        """Test behavior when all schemas are system schemas"""
        mock_engine = Mock()
        mock_inspector = Mock()
        mock_inspector.get_schema_names.return_value = [
            "information_schema",
            "performance_schema",
            "sys",
        ]

        with patch(
            "metadata.ingestion.source.database.databricks.connection.inspect"
        ) as mock_inspect:
            mock_inspect.return_value = mock_inspector

            wrapper = self.DatabricksEngineWrapper(mock_engine)
            schemas = wrapper.get_schemas()

            # Should return all schemas
            self.assertEqual(
                schemas, ["information_schema", "performance_schema", "sys"]
            )
            # Should fall back to the first schema when all are system schemas
            self.assertEqual(wrapper.first_schema, "information_schema")
