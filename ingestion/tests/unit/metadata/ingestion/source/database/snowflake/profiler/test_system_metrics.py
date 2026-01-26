from datetime import datetime
from unittest.mock import MagicMock, Mock, patch

import pytest

from metadata.generated.schema.entity.data.table import (
    DmlOperationType,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.ingestion.source.database.snowflake.models import (
    SnowflakeDynamicTableRefreshEntry,
)
from metadata.profiler.metrics.system.snowflake.system import (
    PUBLIC_SCHEMA,
    SnowflakeSystemMetricsComputer,
    SnowflakeTableResovler,
)
from metadata.utils.profiler_utils import get_identifiers_from_string


@pytest.mark.parametrize(
    "schema_name",
    ["test_schema", PUBLIC_SCHEMA, None],
)
@pytest.mark.parametrize(
    "existing_tables",
    [
        ["db.test_schema.test_table", "db.PUBLIC.test_table"],
        ["db.test_schema.test_table"],
        ["db.PUBLIC.test_table"],
        [],
    ],
)
def test_resolve_snoflake_fqn(schema_name, existing_tables):
    def expected_result(schema_name, existing_tables):
        if len(existing_tables) == 0:
            return RuntimeError
        if schema_name == "test_schema":
            if "db.test_schema.test_table" in existing_tables:
                return "db", "test_schema", "test_table"
            if "db.PUBLIC.test_table" in existing_tables:
                return "db", PUBLIC_SCHEMA, "test_table"
        if (
            schema_name in [None, PUBLIC_SCHEMA]
            and "db.PUBLIC.test_table" in existing_tables
        ):
            return "db", PUBLIC_SCHEMA, "test_table"
        return RuntimeError

    resolver = SnowflakeTableResovler(Mock())

    def mock_show_tables(_, schema, table):
        for t in existing_tables:
            if t == f"db.{schema}.{table}":
                return True

    resolver.show_tables = mock_show_tables
    expected = expected_result(schema_name, existing_tables)
    if expected == RuntimeError:
        with pytest.raises(expected):
            resolver.resolve_implicit_fqn("db", schema_name, "test_table")
    else:
        result = resolver.resolve_implicit_fqn("db", schema_name, "test_table")
        assert result == expected


@pytest.mark.parametrize("context_database", [None, "context_db"])
@pytest.mark.parametrize("context_schema", [None, "context_schema", PUBLIC_SCHEMA])
@pytest.mark.parametrize(
    "identifier",
    [
        "",
        "test_table",
        "id_schema.test_table",
        "PUBLIC.test_table",
        "id_db.test_schema.test_table",
        "id_db.PUBLIC.test_table",
    ],
)
@pytest.mark.parametrize(
    "resolved_schema",
    [
        PUBLIC_SCHEMA,
        "context_schema",
        RuntimeError("could not resolve schema"),
    ],
)
def test_get_identifiers(
    context_database,
    context_schema,
    identifier,
    resolved_schema,
):
    def expected_result():
        if identifier == "":
            return RuntimeError("Could not extract the table name.")
        db, id_schema, table = get_identifiers_from_string(identifier)
        if db is None and context_database is None:
            return RuntimeError("Could not resolve database name.")
        if id_schema is None and isinstance(resolved_schema, RuntimeError):
            return RuntimeError("could not resolve schema")
        return (
            (db or context_database),
            (id_schema or resolved_schema or context_schema),
            table,
        )

    resolver = SnowflakeTableResovler(Mock())
    if isinstance(resolved_schema, RuntimeError):
        resolver.resolve_implicit_fqn = MagicMock(side_effect=resolved_schema)
    else:
        resolver.resolve_implicit_fqn = MagicMock(
            return_value=(context_database, resolved_schema, identifier)
        )

    expected_value = expected_result()
    if isinstance(expected_value, RuntimeError):
        with pytest.raises(type(expected_value), match=str(expected_value)) as e:
            resolver.resolve_snowflake_fqn(context_database, context_schema, identifier)
    else:
        assert expected_value == resolver.resolve_snowflake_fqn(
            context_database, context_schema, identifier
        )


class TestSnowflakeSystemMetricsComputerDynamicTable:
    """Test class for dynamic table system metrics"""

    @pytest.fixture
    def mock_runner(self):
        runner = Mock()
        runner.table_name = "test_dynamic_table"
        runner.schema_name = "test_schema"
        mock_bind = Mock()
        mock_bind.url.database = "test_db"
        runner.session.get_bind.return_value = mock_bind
        return runner

    @pytest.fixture
    def mock_session(self):
        return Mock()

    @pytest.fixture
    def mock_service_connection_config(self):
        config = Mock(spec=SnowflakeConnection)
        config.accountUsageSchema = "SNOWFLAKE.ACCOUNT_USAGE"
        return config

    @pytest.fixture
    def dynamic_table_entity(self):
        entity = Mock(spec=Table)
        entity.tableType = TableType.Dynamic
        return entity

    @pytest.fixture
    def regular_table_entity(self):
        entity = Mock(spec=Table)
        entity.tableType = TableType.Regular
        return entity

    def test_is_dynamic_table_true(
        self,
        mock_session,
        mock_runner,
        mock_service_connection_config,
        dynamic_table_entity,
    ):
        computer = SnowflakeSystemMetricsComputer(
            session=mock_session,
            runner=mock_runner,
            service_connection_config=mock_service_connection_config,
            table_entity=dynamic_table_entity,
        )
        assert computer.is_dynamic_table is True

    def test_is_dynamic_table_false(
        self,
        mock_session,
        mock_runner,
        mock_service_connection_config,
        regular_table_entity,
    ):
        computer = SnowflakeSystemMetricsComputer(
            session=mock_session,
            runner=mock_runner,
            service_connection_config=mock_service_connection_config,
            table_entity=regular_table_entity,
        )
        assert computer.is_dynamic_table is False

    def test_get_dynamic_table_system_profile_inserts(
        self,
        mock_session,
        mock_runner,
        mock_service_connection_config,
        dynamic_table_entity,
    ):
        computer = SnowflakeSystemMetricsComputer(
            session=mock_session,
            runner=mock_runner,
            service_connection_config=mock_service_connection_config,
            table_entity=dynamic_table_entity,
        )

        mock_entries = [
            SnowflakeDynamicTableRefreshEntry(
                table_name="test_dynamic_table",
                start_time=datetime(2024, 1, 1, 12, 0, 0),
                rows_inserted=100,
                rows_updated=0,
                rows_deleted=0,
            ),
            SnowflakeDynamicTableRefreshEntry(
                table_name="test_dynamic_table",
                start_time=datetime(2024, 1, 1, 13, 0, 0),
                rows_inserted=50,
                rows_updated=10,
                rows_deleted=5,
            ),
        ]

        with patch.object(
            computer, "_get_dynamic_table_refresh_entries", return_value=mock_entries
        ):
            result = computer.get_inserts()

        assert len(result) == 2
        assert result[0].operation == DmlOperationType.INSERT
        assert result[0].rowsAffected == 100
        assert result[1].rowsAffected == 50

    def test_get_dynamic_table_system_profile_updates(
        self,
        mock_session,
        mock_runner,
        mock_service_connection_config,
        dynamic_table_entity,
    ):
        computer = SnowflakeSystemMetricsComputer(
            session=mock_session,
            runner=mock_runner,
            service_connection_config=mock_service_connection_config,
            table_entity=dynamic_table_entity,
        )

        mock_entries = [
            SnowflakeDynamicTableRefreshEntry(
                table_name="test_dynamic_table",
                start_time=datetime(2024, 1, 1, 12, 0, 0),
                rows_inserted=100,
                rows_updated=25,
                rows_deleted=0,
            ),
        ]

        with patch.object(
            computer, "_get_dynamic_table_refresh_entries", return_value=mock_entries
        ):
            result = computer.get_updates()

        assert len(result) == 1
        assert result[0].operation == DmlOperationType.UPDATE
        assert result[0].rowsAffected == 25

    def test_get_dynamic_table_system_profile_deletes(
        self,
        mock_session,
        mock_runner,
        mock_service_connection_config,
        dynamic_table_entity,
    ):
        computer = SnowflakeSystemMetricsComputer(
            session=mock_session,
            runner=mock_runner,
            service_connection_config=mock_service_connection_config,
            table_entity=dynamic_table_entity,
        )

        mock_entries = [
            SnowflakeDynamicTableRefreshEntry(
                table_name="test_dynamic_table",
                start_time=datetime(2024, 1, 1, 12, 0, 0),
                rows_inserted=0,
                rows_updated=0,
                rows_deleted=15,
            ),
        ]

        with patch.object(
            computer, "_get_dynamic_table_refresh_entries", return_value=mock_entries
        ):
            result = computer.get_deletes()

        assert len(result) == 1
        assert result[0].operation == DmlOperationType.DELETE
        assert result[0].rowsAffected == 15

    def test_get_dynamic_table_filters_zero_rows(
        self,
        mock_session,
        mock_runner,
        mock_service_connection_config,
        dynamic_table_entity,
    ):
        computer = SnowflakeSystemMetricsComputer(
            session=mock_session,
            runner=mock_runner,
            service_connection_config=mock_service_connection_config,
            table_entity=dynamic_table_entity,
        )

        mock_entries = [
            SnowflakeDynamicTableRefreshEntry(
                table_name="test_dynamic_table",
                start_time=datetime(2024, 1, 1, 12, 0, 0),
                rows_inserted=0,
                rows_updated=0,
                rows_deleted=0,
            ),
        ]

        with patch.object(
            computer, "_get_dynamic_table_refresh_entries", return_value=mock_entries
        ):
            inserts = computer.get_inserts()
            updates = computer.get_updates()
            deletes = computer.get_deletes()

        assert len(inserts) == 0
        assert len(updates) == 0
        assert len(deletes) == 0

    def test_get_dynamic_table_filters_by_table_name(
        self,
        mock_session,
        mock_runner,
        mock_service_connection_config,
        dynamic_table_entity,
    ):
        computer = SnowflakeSystemMetricsComputer(
            session=mock_session,
            runner=mock_runner,
            service_connection_config=mock_service_connection_config,
            table_entity=dynamic_table_entity,
        )

        mock_entries = [
            SnowflakeDynamicTableRefreshEntry(
                table_name="other_table",
                start_time=datetime(2024, 1, 1, 12, 0, 0),
                rows_inserted=100,
                rows_updated=50,
                rows_deleted=25,
            ),
            SnowflakeDynamicTableRefreshEntry(
                table_name="test_dynamic_table",
                start_time=datetime(2024, 1, 1, 13, 0, 0),
                rows_inserted=10,
                rows_updated=5,
                rows_deleted=2,
            ),
        ]

        with patch.object(
            computer, "_get_dynamic_table_refresh_entries", return_value=mock_entries
        ):
            inserts = computer.get_inserts()

        assert len(inserts) == 1
        assert inserts[0].rowsAffected == 10
