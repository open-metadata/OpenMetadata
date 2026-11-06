#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Tests for Snowflake DDL retrieval."""

from collections.abc import Callable
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch

import pytest
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.snowflake import utils as snowflake_utils
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource


def test_view_definition_fallback_closes_result():
    dialect = MagicMock(default_schema_name="PUBLIC")
    connection = MagicMock()
    cursor = connection.execute.return_value
    cursor.fetchone.return_value = ("SELECT 1",)

    with patch.object(
        snowflake_utils,
        "get_view_definition_wrapper",
        return_value=None,
    ):
        result = snowflake_utils.get_view_definition(
            dialect,
            connection,
            table_name="ORDERS_VIEW",
            schema="ANALYTICS",
        )

    assert result == "SELECT 1"
    execute_args = connection.execute.call_args.args
    assert len(execute_args) == 1
    assert "GET_DDL('VIEW', '\"ANALYTICS\".\"ORDERS_VIEW\"')" in str(execute_args[0])
    cursor.close.assert_called_once_with()


@pytest.mark.parametrize(
    ("getter", "object_type"),
    [
        (snowflake_utils.get_stream_definition, "STREAM"),
        (snowflake_utils.get_semantic_view_definition, "SEMANTIC_VIEW"),
        (snowflake_utils.get_table_ddl, "TABLE"),
    ],
)
def test_ddl_getters_use_literal_object_names_and_close_result(
    getter: Callable[..., str | None],
    object_type: str,
):
    dialect = MagicMock(default_schema_name="PUBLIC")
    connection = MagicMock()
    cursor = connection.execute.return_value
    cursor.fetchone.return_value = ("DDL",)

    result = getter(
        dialect,
        connection,
        "ORDERS_OBJECT",
        schema="ANALYTICS",
    )

    assert result == "DDL"
    execute_args = connection.execute.call_args.args
    assert len(execute_args) == 1
    assert f"GET_DDL('{object_type}', '\"ANALYTICS\".\"ORDERS_OBJECT\"')" in str(execute_args[0])
    cursor.close.assert_called_once_with()


def test_view_definition_fallback_logs_failure_and_closes_result():
    dialect = MagicMock(default_schema_name="PUBLIC")
    connection = MagicMock()
    cursor = connection.execute.return_value
    fetch_error = RuntimeError("fetch failed")
    cursor.fetchone.side_effect = fetch_error

    with (
        patch.object(
            snowflake_utils,
            "get_view_definition_wrapper",
            return_value=None,
        ),
        patch.object(snowflake_utils.logger, "warning") as mock_warning,
    ):
        result = snowflake_utils.get_view_definition(
            dialect,
            connection,
            table_name="ORDERS_VIEW",
            schema="ANALYTICS",
        )

    assert result is None
    mock_warning.assert_called_once_with(
        "Failed to fetch DDL for %s [%s]: %s",
        "VIEW",
        '"ANALYTICS"."ORDERS_VIEW"',
        fetch_error,
    )
    cursor.close.assert_called_once_with()


class TestSnowflakeViewDefinitionIncludeDDL:
    """Issue #21410: since the bulk INFORMATION_SCHEMA.VIEWS read replaced GET_DDL, a view's
    schemaDefinition is its CREATE text exactly as submitted, so a view created WITH COPY GRANTS
    keeps that clause and loses its column list and COMMENT. With includeDDL on, the definition
    must be GET_DDL's again. With it off, the single bulk read stays, as it is enough for lineage.
    """

    # Both captured from a live account for the same view.
    VIEW_DEFINITION = (
        "CREATE OR REPLACE VIEW\nANALYTICS_DB.ANALYTICS.ORDERS_VIEW\nCOPY GRANTS AS SELECT\n"
        '   "ID" AS ID\nFROM ANALYTICS_DB.ANALYTICS.ORDERS'
    )
    GET_DDL = (
        'create or replace view ORDERS_VIEW(\n\tID\n) as SELECT\n   "ID" AS ID\nFROM ANALYTICS_DB.ANALYTICS.ORDERS;'
    )

    @classmethod
    def _connection(cls, get_ddl_error=None):
        """Mock connection answering the bulk VIEW_DEFINITION read and GET_DDL like Snowflake does."""

        def execute(clause):
            if "GET_DDL" in str(clause):
                if get_ddl_error:
                    raise get_ddl_error
                result = MagicMock()
                result.fetchone.return_value = (cls.GET_DDL,)
                return result
            return [SimpleNamespace(view_name="ORDERS_VIEW", schema="ANALYTICS", view_def=cls.VIEW_DEFINITION)]

        connection = MagicMock()
        connection.execute.side_effect = execute
        connection.engine.url.database = "ANALYTICS_DB"
        return connection

    @staticmethod
    def _schema_definition(connection, include_ddl, table_type=TableType.View):
        source = Mock()
        source.source_config.includeDDL = include_ddl
        dialect = SnowflakeDialect()
        # sqlalchemy's Inspector hands its live connection to the dialect method
        inspector = Mock()
        inspector.get_view_definition.side_effect = lambda name, schema, **kw: dialect.get_view_definition(
            connection, name, schema, **kw
        )
        return SnowflakeSource.get_schema_definition(source, table_type, "ORDERS_VIEW", "ANALYTICS", inspector)

    @staticmethod
    def _get_ddl_calls(connection):
        return [call for call in connection.execute.call_args_list if "GET_DDL" in str(call.args[0])]

    @pytest.mark.parametrize("table_type", [TableType.View, TableType.MaterializedView])
    def test_include_ddl_stores_get_ddl_output(self, table_type):
        definition = self._schema_definition(self._connection(), include_ddl=True, table_type=table_type)

        assert definition == self.GET_DDL

    def test_without_include_ddl_keeps_the_single_bulk_read(self):
        connection = self._connection()

        definition = self._schema_definition(connection, include_ddl=False)

        assert definition == self.VIEW_DEFINITION
        assert self._get_ddl_calls(connection) == []

    def test_include_ddl_falls_back_to_bulk_definition_when_get_ddl_fails(self):
        connection = self._connection(get_ddl_error=RuntimeError("Insufficient privileges"))

        definition = self._schema_definition(connection, include_ddl=True)

        assert definition == self.VIEW_DEFINITION
        assert len(self._get_ddl_calls(connection)) == 1
