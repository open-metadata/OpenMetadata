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

"""Unit tests for safe Snowflake query construction."""

from unittest.mock import Mock

import pytest
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

from metadata.ingestion.source.database.incremental_metadata_extraction import (
    IncrementalConfig,
)
from metadata.ingestion.source.database.snowflake.identifiers import (
    quote_qualified_identifier,
)
from metadata.ingestion.source.database.snowflake.queries import (
    build_get_ddl_query,
    set_session_tag_query,
)
from metadata.ingestion.source.database.snowflake.utils import (
    _qualified_identifier,
    _quote_identifier,
    get_table_names,
    get_view_names,
)


@pytest.mark.parametrize(
    "query_tag,expected",
    [
        ("my_tag", "ALTER SESSION SET QUERY_TAG='my_tag'"),
        (
            '{"app":"OpenMetadata"}',
            'ALTER SESSION SET QUERY_TAG=\'{"app":"OpenMetadata"}\'',
        ),
        ("it's a tag", "ALTER SESSION SET QUERY_TAG='it''s a tag'"),
        ("C:\\temp", "ALTER SESSION SET QUERY_TAG='C:\\\\temp'"),
        ("tag\\", "ALTER SESSION SET QUERY_TAG='tag\\\\'"),
        (
            "x' STATEMENT_TIMEOUT_IN_SECONDS=1 Y='",
            "ALTER SESSION SET QUERY_TAG='x'' STATEMENT_TIMEOUT_IN_SECONDS=1 Y='''",
        ),
    ],
    ids=[
        "plain",
        "json",
        "apostrophe",
        "backslash-escape",
        "trailing-backslash",
        "parameter-injection",
    ],
)
def test_set_session_tag_query_keeps_the_tag_inside_one_string_literal(query_tag, expected):
    assert set_session_tag_query(query_tag) == expected


def test_identifier_helpers_escape_embedded_double_quotes():
    schema = 'sales"; DROP SCHEMA secret; --'
    table = 'orders"; DROP TABLE secret; --'

    assert _quote_identifier(schema) == '"sales""; DROP SCHEMA secret; --"'
    assert _qualified_identifier(schema, table) == (
        '"sales""; DROP SCHEMA secret; --"."orders""; DROP TABLE secret; --"'
    )


@pytest.mark.parametrize(
    ("identifier", "expected"),
    [
        ("SNOWFLAKE.ACCOUNT_USAGE", '"SNOWFLAKE"."ACCOUNT_USAGE"'),
        ("snowflake.account_usage", "snowflake.account_usage"),
        (
            '"CUSTOM.DB"."ACCOUNT.USAGE"',
            '"CUSTOM.DB"."ACCOUNT.USAGE"',
        ),
        (
            'GOVERNANCE."ACCOUNT_USAGE""; DROP TABLE secret; --"',
            '"GOVERNANCE"."ACCOUNT_USAGE""; DROP TABLE secret; --"',
        ),
    ],
)
def test_quote_qualified_identifier_prepares_each_name_part(identifier, expected):
    assert quote_qualified_identifier(identifier) == expected


def test_get_ddl_query_keeps_object_name_inside_one_string_literal():
    object_name = _qualified_identifier(
        "sales\\archive",
        "orders' ); DROP TABLE secret; --",
    )

    query = build_get_ddl_query("TABLE", object_name)

    assert "GET_DDL('TABLE'," in query
    assert "'\"sales\\\\archive\".\"orders'' ); DROP TABLE secret; --\"'" in query
    assert ":object_name" not in query


def test_table_name_query_binds_catalog_schema_name():
    dialect = SnowflakeDialect()
    connection = Mock()
    connection.execute.return_value = []
    schema = "sales' OR 1=1 --"

    get_table_names(dialect, connection, schema)

    statement, parameters = connection.execute.call_args.args
    assert schema not in str(statement)
    assert parameters == {"schema": schema}


def test_incremental_view_query_only_passes_actual_bind_parameters():
    dialect = SnowflakeDialect()
    dialect._current_database_schema = Mock(return_value=("ANALYTICS", "PUBLIC"))
    connection = Mock()
    connection.execute.return_value = []
    incremental = IncrementalConfig(enabled=True, start_timestamp=123456789)

    account_usage = 'GOVERNANCE."ACCOUNT_USAGE""; DROP TABLE secret; --"'
    get_view_names(
        dialect,
        connection,
        schema="PUBLIC",
        incremental=incremental,
        account_usage=account_usage,
    )

    statement, parameters = connection.execute.call_args.args
    assert 'from "GOVERNANCE"."ACCOUNT_USAGE""; DROP TABLE secret; --".tables' in str(statement)
    assert account_usage not in str(statement)
    assert parameters == {
        "database": "ANALYTICS",
        "schema": "PUBLIC",
        "date": 123456789,
    }
