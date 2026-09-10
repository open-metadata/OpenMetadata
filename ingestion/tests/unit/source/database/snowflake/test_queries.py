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
    quote_account_usage_schema,
    quote_qualified_identifier,
)
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_FETCH_DATABASE_TAGS,
    SNOWFLAKE_FETCH_SCHEMA_TAGS,
    SNOWFLAKE_FETCH_TABLE_TAGS,
    build_get_ddl_query,
)
from metadata.ingestion.source.database.snowflake.utils import (
    _qualified_identifier,
    _quote_identifier,
    get_table_names,
    get_view_names,
)


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


@pytest.mark.parametrize(
    "template",
    [
        SNOWFLAKE_FETCH_TABLE_TAGS,
        SNOWFLAKE_FETCH_SCHEMA_TAGS,
        SNOWFLAKE_FETCH_DATABASE_TAGS,
    ],
    ids=["table", "schema", "database"],
)
def test_tag_templates_bind_object_names_instead_of_interpolating_them(template):
    """A database named `x' OR 1=1 --` must not be able to close the literal."""
    rendered = template.format(account_usage=quote_account_usage_schema("SNOWFLAKE.ACCOUNT_USAGE"))

    assert "OBJECT_DATABASE = :database_name" in rendered
    assert "'{database_name}'" not in rendered
    assert "{database_name}" not in rendered
