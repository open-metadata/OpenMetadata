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
      CROSS APPLY sys.dm_exec_sql_text(p.plan_handle) AS t
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
FROM sys.objects AS obj
LEFT JOIN sys.extended_properties AS ep
    ON obj.object_id = ep.major_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
JOIN sys.schemas AS s
    ON obj.schema_id = s.schema_id
WHERE
    obj.type IN ('U', 'V') /* User tables and views */
"""
)

MSSQL_ALL_VIEW_DEFINITIONS = textwrap.dedent(
    """
SELECT
    definition view_def,
    views.name view_name,
    sch.name "schema"
FROM sys.sql_modules as mod
INNER JOIN sys.views as views
    ON mod.object_id = views.object_id
INNER JOIN sys.schemas as sch
    ON views.schema_id = sch.schema_id
"""
)

MSSQL_GET_DATABASE = """
SELECT name FROM master.sys.databases order by name
"""

MSSQL_TEST_GET_QUERIES = textwrap.dedent(
    """
      SELECT TOP 1
        t.text query_text
      FROM sys.dm_exec_cached_plans AS p
      INNER JOIN sys.dm_exec_query_stats AS s
        ON p.plan_handle = s.plan_handle
      CROSS APPLY sys.dm_exec_sql_text(p.plan_handle) AS t
      INNER JOIN sys.databases db
        ON db.database_id = t.dbid
"""
)

MSSQL_GET_FOREIGN_KEY = """\
WITH fk_info AS (
    SELECT
        ischema_ref_con.constraint_schema,
        ischema_ref_con.constraint_name,
        ischema_key_col.ordinal_position,
        ischema_key_col.[table_schema],
        ischema_key_col.table_name,
        ischema_ref_con.unique_constraint_schema,
        ischema_ref_con.unique_constraint_name,
        ischema_ref_con.match_option,
        ischema_ref_con.update_rule,
        ischema_ref_con.delete_rule,
        ischema_key_col.column_name AS constrained_column
    FROM
        INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS ischema_ref_con
        INNER JOIN
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE ischema_key_col ON
            ischema_key_col.[table_schema] = ischema_ref_con.constraint_schema
            AND ischema_key_col.constraint_name =
            ischema_ref_con.constraint_name
    WHERE ischema_key_col.table_name = :tablename
        AND ischema_key_col.[table_schema] = :owner
),
constraint_info AS (
    SELECT
        ischema_key_col.constraint_schema,
        ischema_key_col.constraint_name,
        ischema_key_col.ordinal_position,
        ischema_key_col.[table_schema],
        ischema_key_col.table_name,
        ischema_key_col.column_name
    FROM
        INFORMATION_SCHEMA.KEY_COLUMN_USAGE ischema_key_col
),
index_info AS (
    SELECT
        sys.schemas.name AS index_schema,
        sys.indexes.name AS index_name,
        sys.index_columns.key_ordinal AS ordinal_position,
        sys.schemas.name AS [table_schema],
        sys.objects.name AS table_name,
        sys.columns.name AS column_name
    FROM
        sys.indexes
        INNER JOIN
        sys.objects ON
            sys.objects.object_id = sys.indexes.object_id
        INNER JOIN
        sys.schemas ON
            sys.schemas.schema_id = sys.objects.schema_id
        INNER JOIN
        sys.index_columns ON
            sys.index_columns.object_id = sys.objects.object_id
            AND sys.index_columns.index_id = sys.indexes.index_id
        INNER JOIN
        sys.columns ON
            sys.columns.object_id = sys.indexes.object_id
            AND sys.columns.column_id = sys.index_columns.column_id
)
    SELECT
        fk_info.constraint_schema,
        fk_info.constraint_name,
        fk_info.ordinal_position,
        fk_info.constrained_column,
        constraint_info.[table_schema] AS referred_table_schema,
        constraint_info.table_name AS referred_table_name,
        constraint_info.column_name AS referred_column,
        fk_info.match_option,
        fk_info.update_rule,
        fk_info.delete_rule
    FROM
        fk_info INNER JOIN constraint_info ON
            constraint_info.constraint_schema =
                fk_info.unique_constraint_schema
            AND constraint_info.constraint_name =
                fk_info.unique_constraint_name
            AND constraint_info.ordinal_position = fk_info.ordinal_position
    UNION
    SELECT
        fk_info.constraint_schema,
        fk_info.constraint_name,
        fk_info.ordinal_position,
        fk_info.constrained_column,
        index_info.[table_schema] AS referred_table_schema,
        index_info.table_name AS referred_table_name,
        index_info.column_name AS referred_column,
        fk_info.match_option,
        fk_info.update_rule,
        fk_info.delete_rule
    FROM
        fk_info INNER JOIN index_info ON
            index_info.index_schema = fk_info.unique_constraint_schema
            AND index_info.index_name = fk_info.unique_constraint_name
            AND index_info.ordinal_position = fk_info.ordinal_position

    ORDER BY fk_info.constraint_schema, fk_info.constraint_name,
        fk_info.ordinal_position
"""

MSSQL_GET_STORED_PROCEDURES = textwrap.dedent(
    """
SELECT
  ROUTINE_NAME AS name,
  NULL AS owner,            
  ROUTINE_BODY AS language,
  l.definition AS definition
FROM INFORMATION_SCHEMA.ROUTINES r
JOIN sys.procedures p ON p.name = r.ROUTINE_NAME 
JOIN sys.sql_modules l on l.object_id = p.object_id
 WHERE ROUTINE_TYPE = 'PROCEDURE'
   AND ROUTINE_CATALOG = '{database_name}'
   AND ROUTINE_SCHEMA = '{schema_name}' 
   AND LEFT(ROUTINE_NAME, 3) NOT IN ('sp_', 'xp_', 'ms_')
    """
)

MSSQL_GET_STORED_PROCEDURE_QUERIES = textwrap.dedent(
    """
WITH SP_HISTORY (start_time, end_time, procedure_name, query_text) AS (
  select 
    s.last_execution_time start_time,
    DATEADD(s, s.total_elapsed_time/1000, s.last_execution_time) end_time,
    OBJECT_NAME(object_id, database_id) as procedure_name,
    text as query_text
  from sys.dm_exec_procedure_stats s
  CROSS APPLY sys.dm_exec_sql_text(s.plan_handle)
  WHERE OBJECT_NAME(object_id, database_id) IS NOT NULL
    AND s.last_execution_time > '{start_date}'
),
Q_HISTORY (database_name, query_text, start_time, end_time, duration,query_type, schema_name, user_name) AS (
  select    
    db.NAME database_name,
    t.text query_text,
    s.last_execution_time start_time,
    DATEADD(s, s.total_elapsed_time/1000, s.last_execution_time) end_time,
    s.total_elapsed_time/1000 duration,
    case
        when t.text LIKE '%%MERGE%%' then 'MERGE'
        when t.text LIKE '%%UPDATE%%' then 'UPDATE'
        when t.text LIKE '%%SELECT%%INTO%%' then 'CREATE_TABLE_AS_SELECT'
        when t.text LIKE '%%INSERT%%' then 'INSERT'
    else 'UNKNOWN' end query_type,
    NULL schema_name,
    NULL user_name
  FROM sys.dm_exec_cached_plans AS p
  INNER JOIN sys.dm_exec_query_stats AS s
    ON p.plan_handle = s.plan_handle
  CROSS APPLY sys.dm_exec_sql_text(p.plan_handle) AS t
  INNER JOIN sys.databases db
    ON db.database_id = t.dbid
  WHERE t.text NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND t.text NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    AND p.objtype NOT IN ('Prepared', 'Proc')
    AND s.last_execution_time > '{start_date}'
)
select 
  Q.query_type AS QUERY_TYPE,
  Q.database_name  AS QUERY_DATABASE_NAME,
  Q.schema_name AS QUERY_SCHEMA_NAME,
  Q.query_text AS QUERY_TEXT,
  Q.user_name AS QUERY_USER_NAME,
  Q.start_time AS QUERY_START_TIME,
  Q.duration AS QUERY_DURATION,
  SP.procedure_name AS PROCEDURE_NAME,
  SP.query_text AS PROCEDURE_TEXT,
  SP.start_time AS PROCEDURE_START_TIME,
  SP.end_time AS PROCEDURE_END_TIME
from SP_HISTORY SP
JOIN Q_HISTORY Q
  ON (
    Q.start_time BETWEEN SP.start_time and SP.end_time
    OR Q.end_time BETWEEN SP.start_time and SP.end_time
    )
order by PROCEDURE_START_TIME desc
;
    """
)

GET_DB_CONFIGS = textwrap.dedent("DBCC USEROPTIONS;")
