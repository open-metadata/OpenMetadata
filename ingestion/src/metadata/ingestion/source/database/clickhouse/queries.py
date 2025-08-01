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

CLICKHOUSE_SQL_STATEMENT = textwrap.dedent(
    """
        Select
          query_start_time start_time,
          DATEADD(query_duration_ms, query_start_time) end_time,
          query_duration_ms duration,
          'default' database_name,
          user user_name,
          FALSE aborted,
          query_id query_id,
          query query_text,
          databases schema_name,
          tables tables
        From system.query_log
        Where start_time between '{start_time}' and '{end_time}'
        and CAST(type,'Int8') <> 3
        and CAST(type,'Int8') <> 4
        and query NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
        and query NOT LIKE '/* {{"app": "dbt", %%}} */%%'
        {filters}
        and (`type`='QueryFinish' or `type`='QueryStart')
        LIMIT {result_limit}
"""
)


CLICKHOUSE_TABLE_COMMENTS = textwrap.dedent(
    """
SELECT
      database as schema,
      name as table_name,
      comment as table_comment
  FROM system.tables
 WHERE name NOT LIKE '.inner%%'
 and comment <> ''
"""
)

CLICKHOUSE_VIEW_DEFINITIONS = textwrap.dedent(
    """
select
	name as view_name,
	database as schema,
	create_table_query as view_def
from system.tables where engine in ['MaterializedView', 'View']
"""
)

CLICKHOUSE_SQL_STATEMENT_TEST = """
        Select
          query_start_time start_time,
          DATEADD(query_duration_ms, query_start_time) end_time,
          query_duration_ms duration,
          'default' database_name,
          user user_name,
          FALSE aborted,
          query_id query_id,
          query query_text,
          databases schema_name,
          tables tables
        From system.query_log
        LIMIT 2
"""
