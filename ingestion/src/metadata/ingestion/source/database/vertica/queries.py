#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
SQL Queries used during ingestion
"""

import textwrap

# Column comments in Vertica can only happen on Projections
#   https://forum.vertica.com/discussion/238945/vertica-try-to-create-comment
# And Vertica projections follow this naming:
#   https://www.vertica.com/docs/9.2.x/HTML/Content/Authoring/AdministratorsGuide/Projections/WorkingWithProjections.htm
# So to fetch column comments we need to concat the table_name + projection infix + column name.
# Example: querying `v_catalog.comments` we find an object_name for a column in the table vendor_dimension as
# `vendor_dimension_super.vendor_name`. Note how this is the `_super` projection.
# Then, our join looks for the match in `vendor_dimension_%.vendor_name`.
# Note: This might not suit for all column scenarios, but currently we did not find a better way to join
# v_catalog.comments with v_catalog.columns.
VERTICA_GET_COLUMNS = textwrap.dedent(
    """
        SELECT
          column_name,
          data_type,
          column_default,
          is_nullable,
          comment
        FROM v_catalog.columns col
        LEFT JOIN v_catalog.comments com
          ON com.object_type = 'COLUMN'
         AND com.object_name LIKE CONCAT(CONCAT(col.table_name, '_%.'), col.column_name)
        WHERE lower(table_name) = '{table}'
        AND {schema_condition}
        UNION ALL
        SELECT
          column_name,
          data_type,
          '' AS column_default,
          true AS is_nullable,
          ''  AS comment
        FROM v_catalog.view_columns
        WHERE lower(table_name) = '{table}'
        AND {schema_condition}
    """
)

VERTICA_GET_PRIMARY_KEYS = textwrap.dedent(
    """
        SELECT column_name
        FROM v_catalog.primary_keys
        WHERE lower(table_name) = '{table}'
        AND constraint_type = 'p'
        AND {schema_condition}
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
