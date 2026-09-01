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

"""Tests for the Snowflake view-definition fallback."""

from unittest.mock import MagicMock, patch

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
    cursor.close.assert_called_once_with()


def test_view_definition_fallback_logs_failure_and_closes_result():
    dialect = MagicMock(default_schema_name="PUBLIC")
    connection = MagicMock()
    cursor = connection.execute.return_value
    cursor.fetchone.side_effect = RuntimeError("fetch failed")

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
    assert "fetch failed" in mock_warning.call_args.args[0]
    cursor.close.assert_called_once_with()
