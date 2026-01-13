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

UNITY_CATALOG_GET_CATALOGS_TAGS = """
SELECT * FROM `{database}`.information_schema.catalog_tags;
"""

UNITY_CATALOG_GET_ALL_SCHEMA_TAGS = """
SELECT * FROM `{database}`.information_schema.schema_tags;
"""

UNITY_CATALOG_GET_ALL_TABLE_TAGS = """
SELECT * FROM `{database}`.information_schema.table_tags WHERE schema_name = '{schema}';
"""

UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS = """
SELECT * FROM `{database}`.information_schema.column_tags WHERE schema_name = '{schema}';
"""

UNITY_CATALOG_SQL_STATEMENT = textwrap.dedent(
    """
    SELECT
      statement_type AS query_type,
      statement_text AS query_text,
      executed_by AS user_name,
      start_time AS start_time,
      null AS database_name,
      null AS schema_name,
      end_time AS end_time,
      total_duration_ms/1000 AS duration
    from system.query.history
    WHERE statement_text NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND statement_text NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    AND start_time between to_timestamp('{start_time}') and to_timestamp('{end_time}')
    {filters}
    LIMIT {result_limit}
    """
)

UNITY_CATALOG_SQL_STATEMENT_TEST = """
 SELECT statement_text from  system.query.history LIMIT 1
"""
