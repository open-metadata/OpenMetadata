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
from unittest.mock import MagicMock, patch

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
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.mssql.metadata import MssqlSource
from metadata.ingestion.source.database.mssql.models import MssqlStoredProcedure
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_CURRENT_DATABASE,
    MSSQL_GET_DATABASE,
    MSSQL_TEST_GET_QUERIES,
)
from metadata.utils.sqa_utils import update_mssql_ischema_names

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
        service=FullyQualifiedEntityName("mssql_source_test"),
        default=False,
    )
]

EXPECTED_DATABASE_SCHEMA = [
    CreateDatabaseSchemaRequest(
        name=EntityName("sample.schema"),
        database=FullyQualifiedEntityName("mssql_source_test.sample_database"),
    )
]

EXPECTED_TABLE = [
    CreateTableRequest(
        name=EntityName("sample_table"),
        tableType=TableType.Regular.name,
        columns=[
            Column(
                name=ColumnName("sample_col_1"),
                dataType=DataType.VARCHAR.name,
                dataLength=1,
                dataTypeDisplay="varchar(50)",
                constraint="NULL",
                tags=None,
            ),
            Column(
                name=ColumnName("sample_col_2"),
                dataType=DataType.INT.name,
                dataLength=1,
                dataTypeDisplay="int",
                constraint="NULL",
                tags=None,
            ),
            Column(
                name=ColumnName("sample_col_3"),
                dataType=DataType.VARCHAR.name,
                dataLength=1,
                dataTypeDisplay="varchar(50)",
                constraint="NULL",
                tags=None,
            ),
            Column(
                name=ColumnName("sample_col_4"),
                dataType=DataType.VARCHAR.name,
                dataLength=1,
                dataTypeDisplay="varchar(50)",
                constraint="NULL",
                tags=None,
            ),
        ],
        tableConstraints=[],
        databaseSchema=FullyQualifiedEntityName(
            'mssql_source_test.sample_database."sample.schema"'
        ),
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

    def test_get_stored_procedures(self):
        """
        Test that stored procedures are filtered correctly
        """
        self.mssql.source_config.includeStoredProcedures = True
        self.mssql.source_config.storedProcedureFilterPattern = FilterPattern(
            excludes=["sp_exclude"]
        )
        self.mssql.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.mssql.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root

        mock_engine = MagicMock()
        self.mssql.engine = mock_engine

        # Mock rows as objects with _asdict() to mimic SQLAlchemy Row
        row1 = MagicMock()
        row1._asdict.return_value = {
            "name": "sp_include",
            "definition": "def1",
            "language": "SQL",
            "owner": "owner",
        }
        row2 = MagicMock()
        row2._asdict.return_value = {
            "name": "sp_exclude",
            "definition": "def2",
            "language": "SQL",
            "owner": "owner",
        }

        mock_conn = MagicMock()
        mock_conn.execute.return_value.all.return_value = [row1, row2]
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

        results = list(self.mssql.get_stored_procedures())

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].name, "sp_include")


class TestUpdateMssqlIschemaNames:
    """Verify update_mssql_ischema_names mutates the dict in-place and returns None."""

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def setup_method(self, _method, test_connection):
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_mssql_config)
        self.mssql = MssqlSource.create(
            mock_mssql_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    EXPECTED_MSSQL_TYPES = [
        "nvarchar",
        "nchar",
        "ntext",
        "bit",
        "image",
        "binary",
        "smallmoney",
        "money",
        "real",
        "smalldatetime",
        "datetime2",
        "datetimeoffset",
        "sql_variant",
        "uniqueidentifier",
        "xml",
        "hierarchyid",
        "geography",
        "geometry",
    ]

    def test_returns_none(self):
        result = update_mssql_ischema_names({})
        assert result is None

    def test_mutates_dict_in_place(self):
        target = {}
        update_mssql_ischema_names(target)
        for type_key in self.EXPECTED_MSSQL_TYPES:
            assert (
                type_key in target
            ), f"'{type_key}' was not added by update_mssql_ischema_names"

    def test_all_added_types_are_not_none(self):
        target = {}
        update_mssql_ischema_names(target)
        for type_key in self.EXPECTED_MSSQL_TYPES:
            assert target[type_key] is not None, f"'{type_key}' was mapped to None"

    def test_does_not_overwrite_existing_entries(self):
        sentinel = object()
        target = {"existing_key": sentinel}
        update_mssql_ischema_names(target)
        assert target["existing_key"] is sentinel

    @patch(
        "metadata.ingestion.source.database.mssql.connection.test_connection_db_common"
    )
    def test_test_connection_uses_current_db_query_when_not_ingest_all(
        self, mock_test_connection_db_common
    ):
        from metadata.ingestion.source.database.mssql.connection import test_connection

        mock_service_connection = MagicMock()
        mock_service_connection.ingestAllDatabases = False

        test_connection(
            metadata=MagicMock(),
            engine=MagicMock(),
            service_connection=mock_service_connection,
        )

        call_kwargs = mock_test_connection_db_common.call_args
        queries = call_kwargs.kwargs["queries"]
        assert queries["GetDatabases"] == MSSQL_GET_CURRENT_DATABASE
        assert queries["GetQueries"] == MSSQL_TEST_GET_QUERIES

    @patch(
        "metadata.ingestion.source.database.mssql.connection.test_connection_db_common"
    )
    def test_test_connection_uses_all_dbs_query_when_ingest_all(
        self, mock_test_connection_db_common
    ):
        from metadata.ingestion.source.database.mssql.connection import test_connection

        mock_service_connection = MagicMock()
        mock_service_connection.ingestAllDatabases = True

        test_connection(
            metadata=MagicMock(),
            engine=MagicMock(),
            service_connection=mock_service_connection,
        )

        call_kwargs = mock_test_connection_db_common.call_args
        queries = call_kwargs.kwargs["queries"]
        assert queries["GetDatabases"] == MSSQL_GET_DATABASE
        assert queries["GetQueries"] == MSSQL_TEST_GET_QUERIES

    def _setup_stored_procedure_context(self):
        self.mssql.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.mssql.context.get().__dict__[
            "database_schema"
        ] = MOCK_DATABASE_SCHEMA.name.root
        self.mssql.context.get().__dict__[
            "database_service"
        ] = MOCK_DATABASE_SERVICE.name.root
        self.mssql.stored_procedure_desc_map = {}
        self.mssql.encrypted_procedures_cache = {}

    def test_yield_stored_procedure_encrypted_no_definition(self):
        """Encrypted procedure with no definition gets the encrypted message as code"""
        self._setup_stored_procedure_context()
        cache_key = (MOCK_DATABASE.name.root, MOCK_DATABASE_SCHEMA.name.root)
        self.mssql.encrypted_procedures_cache[cache_key] = {"sp_encrypted"}

        sp = MssqlStoredProcedure(name="sp_encrypted", language="SQL", definition=None)
        results = [either.right for either in self.mssql.yield_stored_procedure(sp)]

        assert len(results) == 1
        assert results[0].description is None
        assert results[0].storedProcedureCode.code == (
            "-- Unable to fetch code as this is an encrypted stored procedure"
        )

    def test_yield_stored_procedure_encrypted_with_description(self):
        """Encrypted procedure with existing description preserves description, sets code"""
        self._setup_stored_procedure_context()
        self.mssql.stored_procedure_desc_map[
            (
                MOCK_DATABASE.name.root,
                MOCK_DATABASE_SCHEMA.name.root,
                "sp_encrypted",
            )
        ] = "My procedure description"
        cache_key = (MOCK_DATABASE.name.root, MOCK_DATABASE_SCHEMA.name.root)
        self.mssql.encrypted_procedures_cache[cache_key] = {"sp_encrypted"}

        sp = MssqlStoredProcedure(name="sp_encrypted", language="SQL", definition=None)
        results = [either.right for either in self.mssql.yield_stored_procedure(sp)]

        assert len(results) == 1
        assert results[0].description == Markdown("My procedure description")
        assert results[0].storedProcedureCode.code == (
            "-- Unable to fetch code as this is an encrypted stored procedure"
        )

    def test_yield_stored_procedure_not_encrypted(self):
        """Non-encrypted procedure keeps its definition as code, no encrypted message"""
        self._setup_stored_procedure_context()
        cache_key = (MOCK_DATABASE.name.root, MOCK_DATABASE_SCHEMA.name.root)
        self.mssql.encrypted_procedures_cache[cache_key] = set()

        sp = MssqlStoredProcedure(
            name="sp_normal",
            language="SQL",
            definition="CREATE PROC sp_normal AS SELECT 1",
        )
        results = [either.right for either in self.mssql.yield_stored_procedure(sp)]

        assert len(results) == 1
        assert results[0].description is None
        assert (
            results[0].storedProcedureCode.code == "CREATE PROC sp_normal AS SELECT 1"
        )

    def test_get_encrypted_procedures_caches_per_schema(self):
        """_get_encrypted_procedures queries once per schema and caches"""
        self._setup_stored_procedure_context()

        mock_engine = MagicMock()
        self.mssql.engine = mock_engine

        row = MagicMock()
        row.procedure_name = "sp_secret"
        mock_conn = MagicMock()
        mock_conn.execute.return_value.all.return_value = [row]
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

        database = MOCK_DATABASE.name.root
        schema = MOCK_DATABASE_SCHEMA.name.root
        result1 = self.mssql._get_encrypted_procedures(database, schema)
        result2 = self.mssql._get_encrypted_procedures(database, schema)

        assert result1 == {"sp_secret"}
        assert result1 == result2
        mock_conn.execute.assert_called_once()

    def test_get_encrypted_procedures_handles_error(self):
        """_get_encrypted_procedures returns empty set on query failure"""
        self._setup_stored_procedure_context()

        mock_engine = MagicMock()
        self.mssql.engine = mock_engine

        mock_conn = MagicMock()
        mock_conn.execute.side_effect = Exception("connection error")
        mock_engine.connect.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=False)

        result = self.mssql._get_encrypted_procedures("test_db", "dbo")

        assert result == set()
