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
"""Validate the SQL templates the Oracle usage and lineage sources render."""

import pytest

from metadata.ingestion.source.database.oracle.lineage import OracleLineageSource
from metadata.ingestion.source.database.oracle.usage import OracleUsageSource

RESULT_LIMIT = 1000

# The aliases the usage and lineage sources read off each row.
EXPECTED_COLUMNS = (
    "user_name",
    "database_name",
    "schema_name",
    "aborted",
    "query_text",
    "start_time",
    "duration",
    "end_time",
)


def render(source_class, filter_condition: str = "") -> str:
    """Render the query history statement the way QueryParserSource does."""
    filters = source_class.filters
    if filter_condition:
        filters = f"{filters} AND ({filter_condition})"
    return source_class.sql_stmt.format(
        start_time="2025-03-09 00:00:00",
        end_time="2025-04-29 00:00:00",
        filters=filters,
        result_limit=RESULT_LIMIT,
    )


@pytest.fixture(params=[OracleUsageSource, OracleLineageSource], ids=["usage", "lineage"])
def query_history_statement(request) -> str:
    return render(request.param)


def test_query_history_avoids_row_limiting_clause(query_history_statement):
    """OFFSET/FETCH NEXT is 12.1+ only; on 11g it fails the whole statement with
    ORA-00933 and no query history is ingested.
    https://github.com/open-metadata/OpenMetadata/issues/21054
    """
    statement = query_history_statement.upper()

    assert "OFFSET" not in statement
    assert "FETCH NEXT" not in statement
    assert f"ROWNUM <= {RESULT_LIMIT}" in statement


def test_query_history_orders_before_capping(query_history_statement):
    """The ROWNUM cap must sit outside the ordered inline view, otherwise it
    takes an arbitrary N rows instead of the N most recent ones."""
    statement = query_history_statement.upper()

    assert statement.index("ORDER BY FIRST_LOAD_TIME DESC") < statement.index("ROWNUM <=")
    assert query_history_statement.count("(") == query_history_statement.count(")")


def test_query_history_projects_expected_columns(query_history_statement):
    for column in EXPECTED_COLUMNS:
        assert f"AS {column}" in query_history_statement


def test_query_history_keeps_filter_condition_inside_inline_view():
    """A user supplied filterCondition is appended to the source filters, so it
    has to land in the inline view where the source columns are in scope."""
    statement = render(OracleLineageSource, filter_condition="PARSING_SCHEMA_NAME = 'ETL'")

    assert statement.index("PARSING_SCHEMA_NAME = 'ETL'") < statement.index("ROWNUM <=")
    assert statement.count("(") == statement.count(")")
