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

MSSQL_SQL_STATEMENT = textwrap.dedent(
    """
      SELECT TOP {result_limit}
        db.NAME database_name,
        t.text query_text,
        s.last_execution_time start_time,
        DATEADD(s, s.total_elapsed_time/1000, s.last_execution_time) end_time,
        s.total_elapsed_time/1000 duration,
        NULL schema_name,
        NULL query_type,
        NULL user_name,
        NULL aborted
      FROM sys.dm_exec_cached_plans AS p
      INNER JOIN sys.dm_exec_query_stats AS s
        ON p.plan_handle = s.plan_handle
      CROSS APPLY sys.Dm_exec_sql_text(p.plan_handle) AS t
      INNER JOIN sys.databases db
        ON db.database_id = t.dbid
      WHERE s.last_execution_time between '{start_time}' and '{end_time}'
          AND t.text NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
          AND t.text NOT LIKE '/* {{"app": "dbt", %%}} */%%'
          AND p.objtype != 'Prepared'
          {filters}
      ORDER BY s.last_execution_time DESC
"""
)

MSSQL_GET_TABLE_COMMENTS = textwrap.dedent(
    """
SELECT obj.name AS table_name,
        ep.value AS table_comment,
        s.name AS "schema"
FROM sys.tables AS obj
LEFT JOIN sys.extended_properties AS ep
    ON obj.object_id = ep.major_id AND ep.minor_id = 0
JOIN sys.schemas AS s
    ON obj.schema_id = s.schema_id
WHERE ep.name = 'MS_Description'
"""
)

MSSQL_GET_COLUMN_COMMENTS = textwrap.dedent(
    """
SELECT obj.name AS TableName,
	     col.name AS ColumnName,
       ep.value AS ColumnComment,
       s.name AS schema_name
FROM sys.tables AS obj
INNER JOIN sys.columns AS col ON obj.object_id = col.object_id
INNER JOIN sys.extended_properties AS ep ON col.object_id = ep.major_id AND col.column_id = ep.minor_id
JOIN sys.schemas AS s
    ON obj.schema_id = s.schema_id
WHERE ep.name = 'MS_Description'
  AND obj.name = '{table_name}'
  	And s.name  = '{schema_name}';
"""
)

MSSQL_ALL_VIEW_DEFINITIONS = textwrap.dedent(
    """
select
	definition view_def,
	views.name view_name,
	sch.name "schema"
from sys.sql_modules as mod,
sys.views as views,
sys.schemas as sch
 where
mod.object_id=views.object_id and
views.schema_id=sch.schema_id
"""
)
