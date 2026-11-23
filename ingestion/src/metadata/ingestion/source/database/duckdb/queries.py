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
SQL used by the DuckDB connector.

Every reflection query is scoped to ``current_database()``: one DuckDB file is one
OpenMetadata database, and catalogs attached to the same connection (another file,
``system``, ``temp``) must not leak into it.
"""

import textwrap

from sqlalchemy import text

DUCKDB_SCHEMA_NAMES = text(
    """
    SELECT schema_name
    FROM information_schema.schemata
    WHERE catalog_name = current_database()
      AND schema_name NOT IN ('information_schema', 'pg_catalog')
    ORDER BY schema_name
    """
)

DUCKDB_TABLE_NAMES = text(
    """
    SELECT table_name
    FROM information_schema.tables
    WHERE table_catalog = current_database()
      AND table_schema = :schema_name
      AND table_type = :table_type
    ORDER BY table_name
    """
)

DUCKDB_COLUMNS = text(
    """
    SELECT column_name, data_type, is_nullable, column_default, column_index AS ordinal_position, comment
    FROM duckdb_columns()
    WHERE database_name = current_database()
      AND schema_name = :schema_name
      AND table_name = :table_name
    ORDER BY column_index
    """
)

DUCKDB_VIEW_DEFINITION = text(
    """
    SELECT sql
    FROM duckdb_views()
    WHERE database_name = current_database()
      AND schema_name = :schema_name
      AND view_name = :view_name
    """
)

DUCKDB_TABLE_COMMENT = text(
    """
    SELECT comment
    FROM duckdb_tables()
    WHERE database_name = current_database()
      AND schema_name = :schema_name
      AND table_name = :table_name
    UNION ALL
    SELECT comment
    FROM duckdb_views()
    WHERE database_name = current_database()
      AND schema_name = :schema_name
      AND view_name = :table_name
    """
)

DUCKDB_CONSTRAINTS = text(
    """
    SELECT constraint_column_names, referenced_table, referenced_column_names
    FROM duckdb_constraints()
    WHERE database_name = current_database()
      AND schema_name = :schema_name
      AND table_name = :table_name
      AND constraint_type = :constraint_type
    ORDER BY constraint_index
    """
)

DUCKDB_CURRENT_DATABASE = text("SELECT current_database()")

DUCKDB_QUERY_LOG_TABLE = "main.duckdb_query_log"

DUCKDB_QUERY_LOG_EXISTS = text(
    """
    SELECT 1
    FROM information_schema.tables
    WHERE table_catalog = current_database()
      AND table_schema = 'main'
      AND table_name = 'duckdb_query_log'
    """
)

DUCKDB_QUERY_LOG_TEST = (
    f"SELECT query_text, user_name, schema_name, start_time, duration_ms, aborted FROM {DUCKDB_QUERY_LOG_TABLE} LIMIT 1"
)

DUCKDB_SQL_STATEMENT = textwrap.dedent(
    f"""
    SELECT
        query_text,
        user_name,
        '{{database_name}}' AS database_name,
        COALESCE(schema_name, 'main') AS schema_name,
        start_time,
        COALESCE(start_time + to_milliseconds(CAST(duration_ms AS BIGINT)), start_time) AS end_time,
        duration_ms AS duration,
        aborted,
        NULL AS query_type
    FROM {DUCKDB_QUERY_LOG_TABLE}
    WHERE start_time >= '{{start_time}}'
      AND start_time < '{{end_time}}'
      {{filters}}
    ORDER BY start_time DESC
    LIMIT {{result_limit}}
    """
)

DUCKDB_EMPTY_SQL_STATEMENT = textwrap.dedent(
    """
    SELECT
        CAST(NULL AS VARCHAR) AS query_text,
        CAST(NULL AS VARCHAR) AS user_name,
        CAST(NULL AS VARCHAR) AS database_name,
        CAST(NULL AS VARCHAR) AS schema_name,
        CAST(NULL AS TIMESTAMP) AS start_time,
        CAST(NULL AS TIMESTAMP) AS end_time,
        CAST(NULL AS DOUBLE) AS duration,
        CAST(NULL AS BOOLEAN) AS aborted,
        NULL AS query_type
    WHERE false
    """
)
