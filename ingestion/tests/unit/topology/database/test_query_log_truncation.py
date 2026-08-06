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
Tests that a query log capped by resultLimit is reported to the user
"""

from contextlib import contextmanager
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.usage_source import UsageSource

ROW_FIELDS = {
    "query_text": "SELECT 1",
    "query_type": "SELECT",
    "user_name": "ingestion",
    "start_time": datetime(2026, 8, 1, 10, 0, 0),
    "end_time": datetime(2026, 8, 1, 10, 0, 1),
    "duration": 1.0,
    "cost": None,
    "schema_name": "my_schema",
    "database_name": "my_database",
    "aborted": False,
}


class _Row:
    """Stands in for a SQLAlchemy Row, which the sources read via _asdict()."""

    def _asdict(self):
        return dict(ROW_FIELDS)


def _engine_yielding(row_count: int):
    connection = MagicMock()
    connection.execute.return_value = [_Row() for _ in range(row_count)]

    @contextmanager
    def connect():
        yield connection

    engine = MagicMock()
    engine.connect = connect
    return engine


def _source(cls, method_name: str, row_count: int, result_limit: int):
    source = MagicMock()
    source.get_engine.return_value = [_engine_yielding(row_count)]
    source.get_sql_statement.return_value = "SELECT 1"
    source.source_config.resultLimit = result_limit
    source.config.serviceName = "my_service"
    source.dialect.value = "mssql"
    source.get_database_name.return_value = "my_database"
    source.get_schema_name.return_value = "my_schema"
    source.get_aborted_status.return_value = False
    source.format_query.side_effect = lambda query: query
    source.start = datetime(2026, 8, 1)
    source.end = datetime(2026, 8, 1) + timedelta(days=1)

    method = getattr(cls, method_name)
    return method.__get__(source)


CASES = [
    (UsageSource, "yield_table_queries", "usage may be incomplete"),
    (LineageSource, "yield_table_query", "lineage may be incomplete"),
]


@pytest.mark.parametrize("source_class, method_name, expected_message", CASES)
def test_hitting_the_result_limit_warns(source_class, method_name, expected_message):
    """A capped query log silently drops the oldest queries, so the run has to say so
    at a level the user actually sees.
    """
    bound = _source(source_class, method_name, row_count=5, result_limit=5)

    module = f"metadata.ingestion.source.database.{source_class.__module__.rsplit('.', 1)[-1]}"
    with patch(f"{module}.logger") as mock_logger:
        list(bound())

    warnings = [call.args[0] for call in mock_logger.warning.call_args_list]
    assert any("Reached the configured resultLimit of 5" in message for message in warnings)
    assert any(expected_message in message for message in warnings)


@pytest.mark.parametrize("source_class, method_name, expected_message", CASES)
def test_staying_under_the_result_limit_does_not_warn(source_class, method_name, expected_message):
    bound = _source(source_class, method_name, row_count=2, result_limit=5)

    module = f"metadata.ingestion.source.database.{source_class.__module__.rsplit('.', 1)[-1]}"
    with patch(f"{module}.logger") as mock_logger:
        list(bound())

    warnings = [call.args[0] for call in mock_logger.warning.call_args_list]
    assert not any("resultLimit" in message for message in warnings)
