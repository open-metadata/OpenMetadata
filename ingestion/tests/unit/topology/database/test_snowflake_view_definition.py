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
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.snowflake import utils as snowflake_utils


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
