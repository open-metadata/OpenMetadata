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

DATABRICKS_SQL_STATEMENT = textwrap.dedent(
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
    from {query_history}
    WHERE statement_text NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND statement_text NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    AND start_time between to_timestamp('{start_time}') and to_timestamp('{end_time}')
    {filters}
    LIMIT {result_limit}
    """
)

DATABRICKS_SQL_STATEMENT_TEST = """
 SELECT statement_text from  {query_history} LIMIT 1
"""

DATABRICKS_VIEW_DEFINITIONS = textwrap.dedent(
    """
    select
        TABLE_NAME as view_name,
        TABLE_SCHEMA as schema,
        VIEW_DEFINITION as view_def
    from INFORMATION_SCHEMA.VIEWS WHERE VIEW_DEFINITION IS NOT NULL
    """
)

DATABRICKS_GET_TABLE_COMMENTS = (
    "DESCRIBE TABLE EXTENDED `{database_name}`.`{schema_name}`.`{table_name}`"
)

DATABRICKS_GET_SCHEMA_COMMENTS = (
    "DESCRIBE SCHEMA EXTENDED `{database_name}`.`{schema_name}`"
)

DATABRICKS_GET_CATALOGS = "SHOW CATALOGS"

DATABRICKS_GET_CATALOGS_TAGS = textwrap.dedent(
    """SELECT * FROM `{database_name}`.information_schema.catalog_tags;"""
)

DATABRICKS_GET_SCHEMA_TAGS = textwrap.dedent(
    """
    SELECT 
        * 
    FROM `{database_name}`.information_schema.schema_tags"""
)

DATABRICKS_GET_TABLE_TAGS = textwrap.dedent(
    """
    SELECT 
        * 
    FROM `{database_name}`.information_schema.table_tags 
    """
)

DATABRICKS_GET_COLUMN_TAGS = textwrap.dedent(
    """
    SELECT 
        * 
    FROM `{database_name}`.information_schema.column_tags 
    """
)

DATABRICKS_DDL = "SHOW CREATE TABLE `{table_name}`"
