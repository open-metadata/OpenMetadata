"""
Test SnowflakeQueryLogEntry.get_for_table uses the correct accountUsageSchema
"""

from unittest import TestCase
from unittest.mock import MagicMock

from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.ingestion.source.database.snowflake.models import SnowflakeQueryLogEntry


class TestSnowflakeQueryLogEntry(TestCase):
    def test_get_for_table_uses_default_account_usage_schema(self):
        """Verify query uses default SNOWFLAKE.ACCOUNT_USAGE schema"""
        mock_session = MagicMock()
        mock_session.execute.return_value = []

        service_connection = SnowflakeConnection(
            username="test_user",
            account="test_account",
            warehouse="test_warehouse",
        )

        SnowflakeQueryLogEntry.get_for_table(
            session=mock_session,
            tablename="my_table",
            service_connection_config=service_connection,
        )

        executed_query = str(mock_session.execute.call_args[0][0])
        assert 'SNOWFLAKE.ACCOUNT_USAGE."QUERY_HISTORY"' in executed_query

    def test_get_for_table_uses_custom_account_usage_schema(self):
        """Verify query uses custom accountUsageSchema when specified"""
        mock_session = MagicMock()
        mock_session.execute.return_value = []

        custom_schema = "MY_DATABASE.MY_SCHEMA"
        service_connection = SnowflakeConnection(
            username="test_user",
            account="test_account",
            warehouse="test_warehouse",
            accountUsageSchema=custom_schema,
        )

        SnowflakeQueryLogEntry.get_for_table(
            session=mock_session,
            tablename="my_table",
            service_connection_config=service_connection,
        )

        executed_query = str(mock_session.execute.call_args[0][0])
        assert f'{custom_schema}."QUERY_HISTORY"' in executed_query
        assert "SNOWFLAKE.ACCOUNT_USAGE" not in executed_query

    def test_get_for_table_query_filters_by_tablename(self):
        """Verify query filters by the specified table name"""
        mock_session = MagicMock()
        mock_session.execute.return_value = []

        service_connection = SnowflakeConnection(
            username="test_user",
            account="test_account",
            warehouse="test_warehouse",
        )

        tablename = "orders"
        SnowflakeQueryLogEntry.get_for_table(
            session=mock_session,
            tablename=tablename,
            service_connection_config=service_connection,
        )

        executed_query = str(mock_session.execute.call_args[0][0])
        assert f"QUERY_TEXT ILIKE '%{tablename}%'" in executed_query

    def test_get_for_table_includes_dml_operations(self):
        """Verify query filters for INSERT, UPDATE, DELETE, and MERGE operations"""
        mock_session = MagicMock()
        mock_session.execute.return_value = []

        service_connection = SnowflakeConnection(
            username="test_user",
            account="test_account",
            warehouse="test_warehouse",
        )

        SnowflakeQueryLogEntry.get_for_table(
            session=mock_session,
            tablename="my_table",
            service_connection_config=service_connection,
        )

        executed_query = str(mock_session.execute.call_args[0][0])
        assert "'INSERT'" in executed_query
        assert "'UPDATE'" in executed_query
        assert "'DELETE'" in executed_query
        assert "'MERGE'" in executed_query
