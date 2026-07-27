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
SQL Queries used during ingestion
"""

import textwrap

# Column metadata is read from v_catalog.columns / v_catalog.view_columns only.
# Column comments used to be resolved here with a per-table
# `LEFT JOIN v_catalog.comments`, which cost 1-13s per table and dominated the
# ingestion time (see issue #29429). They are now fetched in a single bulk query
# (`VERTICA_COLUMN_COMMENTS`) and looked up from an in-memory cache, mirroring how
# table comments are handled by `get_all_table_comments`.
VERTICA_GET_COLUMNS = textwrap.dedent(
    """
        SELECT
          column_name,
          data_type,
          column_default,
          is_nullable,
          table_schema
        FROM v_catalog.columns
        WHERE lower(table_name) = '{table}'
          AND {schema_condition}
        UNION ALL
        SELECT
          column_name,
          data_type,
          '' AS column_default,
          true AS is_nullable,
          table_schema
        FROM v_catalog.view_columns
        WHERE lower(table_name) = '{table}'
          AND {schema_condition}
    """
)

# Bulk-fetch every column comment in one shot. `v_catalog.comments` only holds a
# row per object that actually has a comment, so the result set is bounded by the
# number of commented columns (sparse) rather than the total column count.
# For a COLUMN row: object_schema = schema, object_name = table, child_object = column.
VERTICA_COLUMN_COMMENTS = textwrap.dedent(
    """
    SELECT
      object_schema AS schema,
      object_name   AS table_name,
      child_object  AS column_name,
      comment       AS column_comment
    FROM v_catalog.comments
    WHERE object_type = 'COLUMN'
    """
)

VERTICA_VIEW_DEFINITION = textwrap.dedent(
    """
      SELECT VIEW_DEFINITION
      FROM V_CATALOG.VIEWS
      WHERE table_name='{view_name}'
      AND {schema_condition}
    """
)

VERTICA_LIST_DATABASES = "SELECT database_name from v_catalog.databases"

VERTICA_TABLE_COMMENTS = textwrap.dedent(
    """
    SELECT
      object_schema as schema,
      object_name as table_name,
      comment as table_comment
    FROM v_catalog.comments
    WHERE object_type = 'TABLE';
    """
)

VERTICA_SCHEMA_COMMENTS = textwrap.dedent(
    """
    SELECT
      object_name as schema_name,
      comment
    FROM v_catalog.comments
    WHERE object_type = 'SCHEMA';
    """
)


VERTICA_SQL_STATEMENT = textwrap.dedent(
    """
    SELECT
    DBNAME() AS database_name,
    p.query AS query_text,
    r.start_timestamp AS start_time,
    r.end_timestamp AS end_time,
    p.schema_name,
    p.query_duration_us/1000 AS duration,
    p.query_type,
    p.user_name,
    NULL aborted
    FROM query_profiles p
    LEFT JOIN query_requests r
      ON p.TRANSACTION_ID = r.TRANSACTION_ID
     AND p.STATEMENT_ID = r.STATEMENT_ID
    WHERE query_start between '{start_time}' and '{end_time}'
      AND query NOT LIKE '%%/* {{"app": "OpenMetadata", %%}} */%%'
      AND query NOT LIKE '/* {{"app": "dbt", %%}} */%%'
      AND success = 1
      {filters}
    ORDER BY query_start DESC
    LIMIT {result_limit}
    """
)

VERTICA_TEST_GET_QUERIES = """
SELECT 
p.query AS query_text
FROM query_profiles p
    LEFT JOIN query_requests r
      ON p.TRANSACTION_ID = r.TRANSACTION_ID
     AND p.STATEMENT_ID = r.STATEMENT_ID
LIMIT 1
"""  # noqa: W291
