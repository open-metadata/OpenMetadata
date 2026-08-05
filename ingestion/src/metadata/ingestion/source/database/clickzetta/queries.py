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
"""SQL helpers for the ClickZetta query-history adapter."""

import re
from datetime import datetime

_IDENTIFIER_PART = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")
DEFAULT_QUERY_HISTORY_RESULT_LIMIT = 1000
NATIVE_CLICKZETTA_QUERY_HISTORY_TABLE = "sys.information_schema.job_history"


def validate_query_history_table(query_history_table: str) -> str:
    """Validate a configured schema/table identifier before SQL interpolation."""
    if not isinstance(query_history_table, str) or not query_history_table.strip():
        raise ValueError("ClickZetta query history table must be a non-empty identifier")

    table_parts = query_history_table.strip().split(".")
    if any(not _IDENTIFIER_PART.fullmatch(part) for part in table_parts):
        raise ValueError("ClickZetta query history table must contain only dotted SQL identifiers")
    return ".".join(table_parts)


def _validate_result_limit(result_limit: int | None) -> int:
    if result_limit is None:
        return DEFAULT_QUERY_HISTORY_RESULT_LIMIT
    if not isinstance(result_limit, int) or isinstance(result_limit, bool) or result_limit <= 0:
        raise ValueError("ClickZetta query history result limit must be a positive integer")
    return result_limit


def _quote_sql_literal(value: str) -> str:
    return value.replace("'", "''")


def _is_native_query_history_table(query_history_table: str) -> bool:
    return query_history_table.casefold() == NATIVE_CLICKZETTA_QUERY_HISTORY_TABLE


def build_clickzetta_query_history_sql(
    *,
    query_history_table: str,
    start_time: datetime,
    end_time: datetime,
    database_name: str | None = None,
    database_schema: str | None = None,
    filters: str = "",
    result_limit: int | None = None,
) -> str:
    """Build a bounded query against a ClickZetta query-history source.

    ClickZetta deployments can expose query history through different system
    tables or views. Canonical views expose the selected columns directly;
    ClickZetta's native ``sys.information_schema.job_history`` source is
    projected into the same shape here. Both paths remain bounded by time and
    result limit.
    """
    table = validate_query_history_table(query_history_table)
    limit = _validate_result_limit(result_limit)
    extra_filters = f"\n    {filters.strip()}" if filters and filters.strip() else ""
    native_source = _is_native_query_history_table(table)

    if native_source:
        source_projection = """
    job_text AS query_text,
    job_type AS query_type,
    job_creator AS user_name,
    workspace_name AS database_name,
    GET_JSON_OBJECT(input_tables, '$.table[0].namespace[1]') AS schema_name,
    start_time AS start_time,
    end_time AS end_time,
    execution_time AS duration,
    CASE
        WHEN UPPER(status) IN ('FAILED', 'CANCELED', 'CANCELLED', 'ABORTED') THEN TRUE
        ELSE FALSE
    END AS aborted,
    CAST(NULL AS DOUBLE) AS cost
"""
    else:
        source_projection = """
    query_text AS query_text,
    query_type AS query_type,
    user_name AS user_name,
    database_name AS database_name,
    schema_name AS schema_name,
    start_time AS start_time,
    end_time AS end_time,
    duration AS duration,
    aborted AS aborted,
    cost AS cost
"""

    native_scope_filters = ""
    if native_source and database_name:
        native_scope_filters += f"\n  AND database_name = '{_quote_sql_literal(database_name.strip())}'"
    if native_source and database_schema:
        native_scope_filters += f"\n  AND schema_name = '{_quote_sql_literal(database_schema.strip())}'"

    return f"""
SELECT
    query_text AS query_text,
    query_type AS query_type,
    user_name AS user_name,
    database_name AS database_name,
    schema_name AS schema_name,
    start_time AS start_time,
    end_time AS end_time,
    duration AS duration,
    aborted AS aborted,
    cost AS cost
FROM (
SELECT{source_projection}FROM {table}
) AS clickzetta_query_history
WHERE start_time >= '{start_time}'
  AND start_time < '{end_time}'
  AND query_text NOT LIKE '/* {{\"app\": \"OpenMetadata\", %}} */%'
  AND query_text NOT LIKE '/* {{\"app\": \"dbt\", %}} */%'{native_scope_filters}{extra_filters}
ORDER BY start_time
LIMIT {limit}
""".strip()
