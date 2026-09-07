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
from decimal import Decimal
from unittest import TestCase
from unittest.mock import MagicMock, patch

from sqlalchemy.types import INTEGER, VARCHAR, BigInteger, Integer, Numeric

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
from metadata.ingestion.source.database.mssql.lineage import MssqlLineageSource
from metadata.ingestion.source.database.mssql.metadata import MssqlSource
from metadata.ingestion.source.database.mssql.models import MssqlStoredProcedure
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_FOREIGN_KEY,
    MSSQL_SQL_STATEMENT,
    MSSQL_SQL_STATEMENT_CURRENT_DB,
    MSSQL_SQL_STATEMENT_FROM_QUERY_STORE,
)
from metadata.ingestion.source.database.mssql.usage import MssqlUsageSource
from metadata.ingestion.source.database.stored_procedures_mixin import (
    StoredProcedureLineageMixin,
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
    service=EntityReference(id="85811038-099a-11ed-861d-0242ac120002", type="databaseService"),
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
        databaseSchema=FullyQualifiedEntityName('mssql_source_test.sample_database."sample.schema"'),
    )
]


class MssqlUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Mssql Unit Test
    """

    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def __init__(
        self,
        methodName,  # noqa: N803
        test_connection,
    ) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_mssql_config)
        self.mssql = MssqlSource.create(
            mock_mssql_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )
        self.mssql.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        self.thread_id = self.mssql.context.get_current_thread_id()
        self.mssql._inspector_map[self.thread_id] = types.SimpleNamespace()
        self.mssql._inspector_map[self.thread_id].get_columns = lambda table_name, schema_name, table_type, db_name: (
            MOCK_COLUMN_VALUE
        )
        self.mssql._inspector_map[self.thread_id].get_pk_constraint = lambda table_name, schema_name: []
        self.mssql._inspector_map[self.thread_id].get_unique_constraints = lambda table_name, schema_name: []
        self.mssql._inspector_map[self.thread_id].get_foreign_keys = lambda table_name, schema_name: []

    def test_yield_database(self):
        assert EXPECTED_DATABASE == [either.right for either in self.mssql.yield_database(MOCK_DATABASE.name.root)]  # noqa: SIM300

        self.mssql.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        self.mssql.context.get().__dict__["database"] = MOCK_DATABASE.name.root

    @mssql_dialet.db_plus_owner
    def mock_function(self, connection, tablename, dbname, owner, schema, **kw):  # pylint: disable=unused-argument
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
        assert EXPECTED_DATABASE_SCHEMA == [  # noqa: SIM300
            either.right for either in self.mssql.yield_database_schema(model_str(MOCK_DATABASE_SCHEMA.name))
        ]

        self.mssql.context.get().__dict__["database_schema"] = MOCK_DATABASE_SCHEMA.name.root

    def test_yield_table(self):
        assert EXPECTED_TABLE == [either.right for either in self.mssql.yield_table(("sample_table", "Regular"))]  # noqa: SIM300

    def test_get_stored_procedures(self):
        """
        Test that stored procedures are filtered correctly
        """
        self.mssql.source_config.includeStoredProcedures = True
        self.mssql.source_config.storedProcedureFilterPattern = FilterPattern(excludes=["sp_exclude"])
        self.mssql.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.mssql.context.get().__dict__["database_schema"] = MOCK_DATABASE_SCHEMA.name.root

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

    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def setup_method(self, _method, test_connection):
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_mssql_config)
        self.mssql = MssqlSource.create(
            mock_mssql_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    EXPECTED_MSSQL_TYPES = [  # noqa: RUF012
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
            assert type_key in target, f"'{type_key}' was not added by update_mssql_ischema_names"

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

    def _setup_stored_procedure_context(self):
        self.mssql.context.get().__dict__["database"] = MOCK_DATABASE.name.root
        self.mssql.context.get().__dict__["database_schema"] = MOCK_DATABASE_SCHEMA.name.root
        self.mssql.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
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
        assert results[0].storedProcedureCode.code == "CREATE PROC sp_normal AS SELECT 1"

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

    def test_load_description_maps_degrades_gracefully(self):
        """A failing description query is isolated: it is logged, not raised, and the
        remaining independent description loads still run so ingestion continues"""
        self.mssql.encrypted_procedures_cache = {("db", "dbo"): {"sp"}}

        with (
            patch.object(MssqlSource, "set_schema_description_map", side_effect=Exception("boom")) as schema_map,
            patch.object(MssqlSource, "set_database_description_map") as database_map,
            patch.object(MssqlSource, "set_stored_procedure_description_map") as procedure_map,
        ):
            # Must not raise even though the first description query failed
            self.mssql._load_description_maps()

        # A failure in one load must not skip the other independent loads
        schema_map.assert_called_once()
        database_map.assert_called_once()
        procedure_map.assert_called_once()
        assert self.mssql.encrypted_procedures_cache == {}

    def test_load_description_maps_resets_encrypted_cache(self):
        """The per-database encrypted-procedure cache is reset on each database"""
        self.mssql.encrypted_procedures_cache = {("db", "dbo"): {"sp"}}

        with (
            patch.object(MssqlSource, "set_schema_description_map"),
            patch.object(MssqlSource, "set_database_description_map"),
            patch.object(MssqlSource, "set_stored_procedure_description_map"),
        ):
            self.mssql._load_description_maps()

        assert self.mssql.encrypted_procedures_cache == {}

    def test_failed_database_recorded_in_status(self):
        """A database that fails to connect is recorded in status and not yielded"""
        self.mssql.config.serviceConnection.root.config.ingestAllDatabases = True
        self.mssql.context.get().__dict__["database_service"] = MOCK_DATABASE_SERVICE.name.root
        self.mssql.status = MagicMock()

        with (
            patch.object(MssqlSource, "get_database_names_raw", return_value=iter(["bad_db"])),
            patch.object(MssqlSource, "_load_description_maps"),
            patch.object(MssqlSource, "set_inspector", side_effect=Exception("cannot connect")),
        ):
            yielded = list(self.mssql.get_database_names())

        assert yielded == []
        self.mssql.status.failed.assert_called_once()


class MssqlIdentityColumnTest(TestCase):
    """Regression tests for identity column reflection.

    BigInteger identity columns previously crashed with
    ``module 'sqlalchemy.util.compat' has no attribute 'long_type'`` on
    SQLAlchemy 2.0, dropping every column of the affected table.
    """

    def test_bigint_identity_returns_int_values(self):
        result = mssql_dialet.get_identity_values(BigInteger(), Decimal("1"), Decimal("1"))

        assert result == {"start": 1, "increment": 1}
        assert isinstance(result["start"], int)
        assert isinstance(result["increment"], int)

    def test_int_identity_returns_int_values(self):
        result = mssql_dialet.get_identity_values(Integer(), Decimal("5"), Decimal("2"))

        assert result == {"start": 5, "increment": 2}
        assert isinstance(result["start"], int)
        assert isinstance(result["increment"], int)

    def test_non_integer_identity_keeps_original_values(self):
        start, increment = Decimal("1.0"), Decimal("1.0")
        result = mssql_dialet.get_identity_values(Numeric(), start, increment)

        assert result == {"start": start, "increment": increment}

    def test_missing_seed_returns_empty_dict(self):
        assert mssql_dialet.get_identity_values(BigInteger(), None, Decimal("1")) == {}
        assert mssql_dialet.get_identity_values(BigInteger(), Decimal("1"), None) == {}


class TestMssqlForeignKeyReferredDatabase:
    """``get_foreign_keys`` must report the database holding the referred table.

    Without it the caller builds the referred FQN with a ``None`` database and the
    constraint is dropped.
    """

    @staticmethod
    def _fk_row(constraint_name, constrained_column, referred_column):
        return (
            "sales",  # constraint schema
            constraint_name,
            1,  # ordinal position
            constrained_column,
            "sales",  # referred schema
            "customers",
            referred_column,
            None,  # match rule
            "NO ACTION",
            "NO ACTION",
            "my_catalog",  # DB_NAME()
        )

    def _foreign_keys(self, rows):
        from sqlalchemy.dialects.mssql.base import MSDialect

        connection = MagicMock()
        connection.execute.return_value.fetchall.return_value = rows

        return mssql_dialet.get_foreign_keys(MSDialect(), connection, "orders", schema="sales")

    def test_referred_database_comes_from_the_query(self):
        keys = self._foreign_keys([self._fk_row("fk_orders_customer", "customer_id", "id")])

        assert [key["referred_database"] for key in keys] == ["my_catalog"]

    def test_query_selects_the_database_name(self):
        assert "DB_NAME() AS referred_database" in MSSQL_GET_FOREIGN_KEY

    def test_multi_column_key_is_still_grouped(self):
        (key,) = self._foreign_keys(
            [
                self._fk_row("fk_orders_customer", "customer_id", "id"),
                self._fk_row("fk_orders_customer", "customer_region", "region"),
            ]
        )

        assert key["name"] == "fk_orders_customer"
        assert key["referred_table"] == "customers"
        assert key["constrained_columns"] == ["customer_id", "customer_region"]
        assert key["referred_columns"] == ["id", "region"]


class TestMssqlTemporalPeriodColumns:
    """``get_columns`` must reflect SYSTEM_TIME period columns.

    Skipping them left system-versioned tables missing their SysStartTime/SysEndTime
    pair from the catalogue entirely.
    """

    @staticmethod
    def _row(name, data_type="datetime2", generated_always_type=0):
        values = {
            "column_name": name,
            "data_type": data_type,
            "is_nullable": "NO",
            "character_maximum_length": None,
            "numeric_precision": None,
            "numeric_scale": None,
            "column_default": None,
            "collation_name": None,
            "generated_always_type": generated_always_type,
        }

        class _Mapping:
            """Rows come back keyed by the column expression, as cursor.mappings() gives them."""

            def __getitem__(self, key):
                return values.get(getattr(key, "key", key))

        return _Mapping()

    def _get_columns(self, rows):
        from sqlalchemy.dialects.mssql.base import MSDialect

        connection = MagicMock()
        connection.execution_options.return_value.execute.return_value.mappings.return_value = rows

        return mssql_dialet.get_columns(MSDialect(), connection, "orders", schema="sales")

    def test_period_columns_are_reflected(self):
        cols = self._get_columns(
            [
                self._row("id", data_type="int"),
                self._row("SysStartTime", generated_always_type=1),
                self._row("SysEndTime", generated_always_type=2),
            ]
        )

        assert [col["name"] for col in cols] == ["id", "SysStartTime", "SysEndTime"]

    def test_a_table_without_period_columns_is_unaffected(self):
        cols = self._get_columns([self._row("id", data_type="int"), self._row("name", data_type="varchar")])

        assert [col["name"] for col in cols] == ["id", "name"]


class TestMssqlQueryStoreSelection:
    """Auto-detection of Query Store vs plan-cache DMVs for MSSQL lineage and usage."""

    @staticmethod
    def _engine_with_query_store_state(actual_state):
        engine = MagicMock()
        conn = engine.connect.return_value.__enter__.return_value
        conn.execute.return_value.scalar.return_value = actual_state
        return engine

    def test_query_store_enabled_when_read_write(self):
        assert mssql_dialet.is_query_store_enabled(self._engine_with_query_store_state(2)) is True

    def test_query_store_enabled_when_read_only(self):
        assert mssql_dialet.is_query_store_enabled(self._engine_with_query_store_state(1)) is True

    def test_query_store_disabled_when_off(self):
        assert mssql_dialet.is_query_store_enabled(self._engine_with_query_store_state(0)) is False

    def test_query_store_disabled_when_error_state(self):
        assert mssql_dialet.is_query_store_enabled(self._engine_with_query_store_state(3)) is False

    def test_query_store_disabled_when_null_state(self):
        assert mssql_dialet.is_query_store_enabled(self._engine_with_query_store_state(None)) is False

    def test_query_store_disabled_when_engine_missing(self):
        assert mssql_dialet.is_query_store_enabled(None) is False

    def test_query_store_disabled_when_probe_errors(self):
        engine = MagicMock()
        engine.connect.side_effect = Exception("VIEW DATABASE STATE denied")

        assert mssql_dialet.is_query_store_enabled(engine) is False

    @staticmethod
    def _lineage_source(query_store_enabled):
        source = MssqlLineageSource.__new__(MssqlLineageSource)
        source._query_store_enabled = query_store_enabled
        return source

    def test_uses_query_store_probes_once_and_caches(self):
        source = self._lineage_source(None)
        source.engine = MagicMock()
        with patch(
            "metadata.ingestion.source.database.mssql.query_parser.is_query_store_enabled",
            return_value=True,
        ) as probe:
            assert source.uses_query_store() is True
            assert source.uses_query_store() is True

        probe.assert_called_once()

    def test_resolve_query_log_statement_prefers_query_store(self):
        assert self._lineage_source(True).resolve_query_log_statement() == MSSQL_SQL_STATEMENT_FROM_QUERY_STORE

    def test_resolve_query_log_statement_falls_back_to_dmv(self):
        assert self._lineage_source(False).resolve_query_log_statement() == MSSQL_SQL_STATEMENT

    def test_usage_source_shares_query_store_selection(self):
        source = MssqlUsageSource.__new__(MssqlUsageSource)
        source._query_store_enabled = True

        assert source.resolve_query_log_statement() == MSSQL_SQL_STATEMENT_FROM_QUERY_STORE

    def test_stored_procedure_statement_uses_query_store(self):
        source = self._lineage_source(True)
        source.engine = MagicMock()
        source.source_config = MagicMock(queryLogDuration=1)
        with patch(
            "metadata.ingestion.source.database.mssql.lineage.get_sqlalchemy_engine_dateformat",
            return_value=None,
        ):
            statement = source.get_stored_procedure_sql_statement()

        assert "sys.query_store_query" in statement
        assert "object_id <> 0" in statement

    def test_stored_procedure_statement_falls_back_to_dmv(self):
        source = self._lineage_source(False)
        source.engine = MagicMock()
        source.source_config = MagicMock(queryLogDuration=1)
        with patch(
            "metadata.ingestion.source.database.mssql.lineage.get_sqlalchemy_engine_dateformat",
            return_value=None,
        ):
            statement = source.get_stored_procedure_sql_statement()

        assert "sys.dm_exec_procedure_stats" in statement


class TestMssqlPerDatabaseQueryStore:
    """Per-database Query Store engine iteration for ingest-all-databases runs."""

    @staticmethod
    def _source(query_store_enabled, ingest_all_databases):
        source = MssqlLineageSource.__new__(MssqlLineageSource)
        source._query_store_enabled = query_store_enabled
        source.engine = MagicMock()
        source.service_connection = MagicMock(ingestAllDatabases=ingest_all_databases)
        return source

    def test_single_engine_when_not_ingest_all_databases(self):
        source = self._source(query_store_enabled=True, ingest_all_databases=False)

        assert list(source.get_engine()) == [source.engine]

    def test_per_database_even_when_initial_database_lacks_query_store(self):
        # Routing is decided per database, not by the initial connection: an ingest-all
        # run reaches every database even when the connection database has Query Store
        # off, so a Query Store database is never missed.
        source = self._source(query_store_enabled=False, ingest_all_databases=True)
        db_engines = {"NoQsInit": MagicMock(), "HasQs": MagicMock()}
        source._databases_to_scan = lambda: iter(["NoQsInit", "HasQs"])
        source._engine_for_database = lambda database: db_engines[database]

        with patch(
            "metadata.ingestion.source.database.mssql.query_parser.is_query_store_enabled",
            side_effect=lambda engine: engine is db_engines["HasQs"],
        ):
            engines = list(source.get_engine())

        assert engines == [db_engines["NoQsInit"], db_engines["HasQs"]]
        db_engines["NoQsInit"].dispose.assert_called_once()
        db_engines["HasQs"].dispose.assert_called_once()

    def test_per_database_engines_when_query_store_and_ingest_all(self):
        source = self._source(query_store_enabled=True, ingest_all_databases=True)
        db_engines = {"SalesDW": MagicMock(), "Inventory": MagicMock()}
        source._databases_to_scan = lambda: iter(["SalesDW", "Inventory"])
        source._engine_for_database = lambda database: db_engines[database]

        with patch(
            "metadata.ingestion.source.database.mssql.query_parser.is_query_store_enabled",
            return_value=True,
        ):
            engines = list(source.get_engine())

        assert engines == [db_engines["SalesDW"], db_engines["Inventory"]]
        db_engines["SalesDW"].dispose.assert_called_once()
        db_engines["Inventory"].dispose.assert_called_once()

    def test_each_database_routed_by_its_own_query_store(self):
        # Hybrid completeness: the Query Store database is read via Query Store, the
        # non-Query-Store database via its own DB-scoped DMV read. Every database is
        # covered and the Query Store one is never downgraded because the other lacks it.
        source = self._source(query_store_enabled=True, ingest_all_databases=True)
        source.sql_stmt = MSSQL_SQL_STATEMENT
        engines = {"QsDb": MagicMock(), "DmvDb": MagicMock()}
        source._databases_to_scan = lambda: iter(["QsDb", "DmvDb"])
        source._engine_for_database = lambda database: engines[database]

        with patch(
            "metadata.ingestion.source.database.mssql.query_parser.is_query_store_enabled",
            side_effect=lambda engine: engine is engines["QsDb"],
        ):
            routed = [(engine, source.resolve_query_log_statement()) for engine in source.get_engine()]

        assert routed == [
            (engines["QsDb"], MSSQL_SQL_STATEMENT_FROM_QUERY_STORE),
            (engines["DmvDb"], MSSQL_SQL_STATEMENT_CURRENT_DB),
        ]
        engines["QsDb"].dispose.assert_called_once()
        engines["DmvDb"].dispose.assert_called_once()

    def test_stored_procedure_statement_routes_by_active_query_store(self):
        source = self._source(query_store_enabled=True, ingest_all_databases=True)
        source.source_config = MagicMock(queryLogDuration=1)
        with patch(
            "metadata.ingestion.source.database.mssql.lineage.get_sqlalchemy_engine_dateformat",
            return_value=None,
        ):
            source._active_query_store = True
            qs_statement = source.get_stored_procedure_sql_statement()
            source._active_query_store = False
            dmv_statement = source.get_stored_procedure_sql_statement()

        assert "sys.query_store_query" in qs_statement
        assert "sys.dm_exec_procedure_stats" in dmv_statement

    def test_databases_to_scan_applies_database_filter(self):
        source = self._source(query_store_enabled=True, ingest_all_databases=True)
        source.source_config = MagicMock(databaseFilterPattern=FilterPattern(includes=["^SalesDW$", "^Inventory$"]))
        conn = source.engine.connect.return_value.__enter__.return_value
        conn.execute.return_value.fetchall.return_value = [
            ("SalesDW",),
            ("Inventory",),
            ("Archive",),
        ]

        assert list(source._databases_to_scan()) == ["SalesDW", "Inventory"]

    def test_falls_back_to_dmv_when_no_user_databases_scanned(self):
        source = self._source(query_store_enabled=True, ingest_all_databases=True)
        source._databases_to_scan = lambda: iter([])

        assert list(source.get_engine()) == [source.engine]

    def test_stored_procedure_engines_follow_get_engine(self):
        source = self._source(query_store_enabled=True, ingest_all_databases=False)

        assert list(source.get_stored_procedure_engines()) == [source.engine]

    def test_mixin_default_stored_procedure_engines_is_single(self):
        fake_source = types.SimpleNamespace(engine=MagicMock())

        engines = list(StoredProcedureLineageMixin.get_stored_procedure_engines(fake_source))

        assert engines == [fake_source.engine]
