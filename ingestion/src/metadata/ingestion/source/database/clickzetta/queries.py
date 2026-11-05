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
from enum import Enum

_IDENTIFIER_PART = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")
DEFAULT_QUERY_HISTORY_RESULT_LIMIT = 1000
NATIVE_CLICKZETTA_QUERY_HISTORY_TABLE = "sys.information_schema.job_history"
WORKSPACE_CLICKZETTA_QUERY_HISTORY_TABLE = "information_schema.job_history"
NATIVE_CLICKZETTA_QUERY_HISTORY_TABLES = frozenset(
    {
        NATIVE_CLICKZETTA_QUERY_HISTORY_TABLE,
        WORKSPACE_CLICKZETTA_QUERY_HISTORY_TABLE,
    }
)
MAX_QUERY_HISTORY_FILTER_CONDITION_LENGTH = 4096
_QUERY_HISTORY_FILTER_COLUMN = r"(?:database_name|schema_name|query_type|user_name)"
_QUERY_HISTORY_FILTER_OPERATOR = r"(?:NOT\s+LIKE|LIKE|!=|<>|=)"
_SQL_STRING_LITERAL = r"'(?:''|[^'])*'"
_QUERY_HISTORY_FILTER_PREDICATE = (
    rf"{_QUERY_HISTORY_FILTER_COLUMN}\s*{_QUERY_HISTORY_FILTER_OPERATOR}\s*{_SQL_STRING_LITERAL}"
)
_QUERY_HISTORY_FILTER_CONDITION = re.compile(
    rf"^\s*{_QUERY_HISTORY_FILTER_PREDICATE}(?:\s+AND\s+{_QUERY_HISTORY_FILTER_PREDICATE})*\s*$",
    re.IGNORECASE,
)


class ClickzettaQueryHistoryMode(str, Enum):
    """Connector-owned query-history query modes."""

    USAGE = "usage"
    LINEAGE = "lineage"


_QUERY_HISTORY_MODE_FILTERS = {
    ClickzettaQueryHistoryMode.USAGE: """
  AND (
      query_type IS NULL
      OR upper(query_type) NOT IN (
          'ALTER', 'CREATE_TABLE', 'CREATE_TABLE_AS_SELECT', 'CREATE_VIEW',
          'DROP', 'SHOW', 'DESCRIBE', 'USE'
      )
  )
""",
    ClickzettaQueryHistoryMode.LINEAGE: """
  AND (
      upper(query_type) IN (
          'CREATE_TABLE_AS_SELECT', 'CREATE_VIEW', 'INSERT', 'MERGE', 'UPDATE'
      )
      OR lower(query_text) LIKE '%insert%into%select%'
      OR lower(query_text) LIKE '%create%table%as%select%'
      OR lower(query_text) LIKE '%merge%into%'
  )
""",
}


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
    return query_history_table.casefold() in NATIVE_CLICKZETTA_QUERY_HISTORY_TABLES


def validate_query_history_filter_condition(filter_condition: object | None) -> str:
    """Allow only a constrained user-supplied predicate for query history.

    ``filterCondition`` is service configuration, but it must never become an
    arbitrary SQL fragment. The supported syntax deliberately covers scoped
    canonical query-history views while excluding functions, subqueries,
    comments, statement separators, and broadening ``OR`` expressions.
    """
    if filter_condition is None:
        return ""
    if not isinstance(filter_condition, str):
        raise TypeError("ClickZetta filterCondition must be a string")

    condition = filter_condition.strip()
    if not condition:
        return ""
    if len(condition) > MAX_QUERY_HISTORY_FILTER_CONDITION_LENGTH:
        raise ValueError("ClickZetta filterCondition exceeds the maximum supported length")
    if not _QUERY_HISTORY_FILTER_CONDITION.fullmatch(condition):
        raise ValueError(
            "ClickZetta filterCondition supports only AND-separated =, !=, <>, LIKE, "
            "or NOT LIKE predicates on database_name, schema_name, query_type, or user_name "
            "with single-quoted string literals"
        )
    return condition


def build_clickzetta_query_history_sql(
    *,
    query_history_table: str,
    start_time: datetime,
    end_time: datetime,
    database_name: str | None = None,
    database_schema: str | None = None,
    query_history_mode: ClickzettaQueryHistoryMode,
    filter_condition: object | None = None,
    result_limit: int | None = None,
) -> str:
    """Build a bounded query against a ClickZetta query-history source.

    ClickZetta deployments can expose query history through different system
    tables or views. Canonical views expose the selected columns directly;
    ClickZetta's native workspace-local ``information_schema.job_history`` and
    cross-workspace ``sys.information_schema.job_history`` sources are projected
    into the same shape here. All paths remain bounded by time and result limit.
    """
    table = validate_query_history_table(query_history_table)
    limit = _validate_result_limit(result_limit)
    user_filter_condition = validate_query_history_filter_condition(filter_condition)
    mode_filters = _QUERY_HISTORY_MODE_FILTERS[query_history_mode].strip()
    user_filter = f"\n  AND ({user_filter_condition})" if user_filter_condition else ""
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

    scope_filters = ""
    if database_name:
        scope_filters += f"\n  AND database_name = '{_quote_sql_literal(database_name.strip())}'"
    if database_schema:
        scope_filters += f"\n  AND schema_name = '{_quote_sql_literal(database_schema.strip())}'"

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
  AND query_text NOT LIKE '/* {{\"app\": \"dbt\", %}} */%'
  {mode_filters}{scope_filters}{user_filter}
ORDER BY start_time
LIMIT {limit}
""".strip()
