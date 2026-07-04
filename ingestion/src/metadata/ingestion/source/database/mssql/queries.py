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

MSSQL_SQL_STATEMENT = textwrap.dedent(
    """
      SELECT TOP {result_limit}
        db.NAME database_name,
        t.text query_text,
        s.last_execution_time start_time,
        DATEADD(s, s.last_elapsed_time/1000000, s.last_execution_time) end_time,
        s.last_elapsed_time/1000000 duration,
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

# Query Store variant of MSSQL_SQL_STATEMENT: durable per-statement history.
# object_id = 0 keeps this to ad-hoc statements only, so the statements executed
# inside stored procedures are left to the stored-procedure lineage path and are
# not double-counted here. The inner query is aliased `t` and exposes `text` so the
# same {filters} (which reference t.text) apply unchanged.
# end_time is an aggregate estimate (max last_execution_time + avg duration), not a
# measured per-execution end. It is used only for ordering and lineage, never for
# precise per-execution timing.
MSSQL_SQL_STATEMENT_FROM_QUERY_STORE = textwrap.dedent(
    """
      SELECT TOP {result_limit}
        t.database_name,
        t.text query_text,
        t.start_time,
        t.end_time,
        t.duration,
        NULL schema_name,
        NULL query_type,
        NULL user_name,
        NULL aborted
      FROM (
        SELECT
          DB_NAME() AS database_name,
          qt.query_sql_text AS text,
          MAX(rs.last_execution_time) AS start_time,
          DATEADD(s, CAST(AVG(rs.avg_duration) / 1000000 AS INT), MAX(rs.last_execution_time)) AS end_time,
          AVG(rs.avg_duration) / 1000000.0 AS duration
        FROM sys.query_store_query AS q
        INNER JOIN sys.query_store_query_text AS qt
          ON qt.query_text_id = q.query_text_id
        INNER JOIN sys.query_store_plan AS p
          ON p.query_id = q.query_id
        INNER JOIN sys.query_store_runtime_stats AS rs
          ON rs.plan_id = p.plan_id
        WHERE ISNULL(q.object_id, 0) = 0
          AND rs.last_execution_time BETWEEN '{start_time}' AND '{end_time}'
        GROUP BY q.query_id, qt.query_sql_text
      ) AS t
      WHERE t.text NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
        AND t.text NOT LIKE '/* {{"app": "dbt", %%}} */%%'
        {filters}
      ORDER BY t.start_time DESC
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

MSSQL_GET_DATABASE_COMMENTS = textwrap.dedent(
    """
    SELECT 
    DB_NAME() AS DATABASE_NAME,
    CAST(ep.value AS NVARCHAR(MAX)) AS COMMENT
FROM sys.extended_properties ep
WHERE ep.class = 0  
AND ep.name = 'MS_Description'
"""  # noqa: W291
)

MSSQL_GET_SCHEMA_COMMENTS = textwrap.dedent(
    """
     SELECT 
    DB_NAME() AS DATABASE_NAME, 
    s.name AS SCHEMA_NAME, 
    CAST(ep.value AS NVARCHAR(MAX)) AS COMMENT 
FROM sys.schemas s
LEFT JOIN sys.extended_properties ep 
    ON ep.major_id = s.schema_id
    AND ep.minor_id = 0 
    AND ep.class = 3
    AND ep.name = 'MS_Description'
    """  # noqa: W291
)

MSSQL_GET_STORED_PROCEDURE_COMMENTS = textwrap.dedent(
    """
SELECT 
    DB_NAME() AS DATABASE_NAME,
    s.name AS SCHEMA_NAME,
    p.name AS STORED_PROCEDURE,
    CAST(ep.value AS NVARCHAR(MAX)) AS COMMENT
FROM sys.procedures p
JOIN sys.schemas s ON p.schema_id = s.schema_id
LEFT JOIN sys.extended_properties ep 
    ON ep.major_id = p.object_id 
    AND ep.minor_id = 0 
    AND ep.class = 1
    AND ep.name = 'MS_Description';
"""  # noqa: W291
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

MSSQL_GET_QUERY_STORE_DATABASES = """
SELECT name
FROM sys.databases
WHERE state = 0
  AND database_id > 4
  AND HAS_DBACCESS(name) = 1
ORDER BY name
"""

MSSQL_GET_CURRENT_DATABASE = """
SELECT DB_NAME() AS name
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

MSSQL_TEST_GET_QUERIES_FROM_QUERY_STORE = textwrap.dedent(
    """
      SELECT TOP 1
        query_sql_text
      FROM sys.query_store_query_text
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
    """  # noqa: W291
)

MSSQL_GET_ENCRYPTED_STORED_PROCEDURES = textwrap.dedent(
    """
SELECT p.name AS procedure_name
FROM sys.procedures p
JOIN sys.schemas s ON s.schema_id = p.schema_id
WHERE s.name = :schema_name
  AND OBJECTPROPERTY(p.object_id, 'IsEncrypted') = 1
    """
)

MSSQL_GET_STORED_PROCEDURE_QUERIES = textwrap.dedent(
    """
WITH SP_HISTORY (start_time, end_time, procedure_name, query_text) AS (
  select 
    s.last_execution_time start_time,
    DATEADD(s, s.last_elapsed_time/1000000, s.last_execution_time) end_time,
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
    DATEADD(s, s.last_elapsed_time/1000000, s.last_execution_time) end_time,
    s.last_elapsed_time/1000000 duration,
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
    """  # noqa: W291
)

MSSQL_GET_QUERY_STORE_STATE = "SELECT actual_state FROM sys.database_query_store_options"

MSSQL_GET_STORED_PROCEDURE_QUERIES_FROM_QUERY_STORE = textwrap.dedent(
    """
WITH proc_statements AS (
    SELECT
        q.object_id                          AS object_id,
        qt.query_sql_text                    AS query_text,
        MAX(rs.last_execution_time)          AS last_execution_time,
        MIN(rs.first_execution_time)         AS first_execution_time,
        AVG(rs.avg_duration) / 1000000.0     AS duration_seconds
    FROM sys.query_store_query AS q
    INNER JOIN sys.query_store_query_text AS qt
        ON qt.query_text_id = q.query_text_id
    INNER JOIN sys.query_store_plan AS p
        ON p.query_id = q.query_id
    INNER JOIN sys.query_store_runtime_stats AS rs
        ON rs.plan_id = p.plan_id
    WHERE q.object_id <> 0
      AND rs.last_execution_time > '{start_date}'
    GROUP BY q.object_id, q.query_id, qt.query_sql_text
)
SELECT
    CASE
        WHEN query_text LIKE '%%MERGE%%'        THEN 'MERGE'
        WHEN query_text LIKE '%%UPDATE%%'       THEN 'UPDATE'
        WHEN query_text LIKE '%%SELECT%%INTO%%' THEN 'CREATE_TABLE_AS_SELECT'
        WHEN query_text LIKE '%%INSERT%%'       THEN 'INSERT'
        ELSE 'UNKNOWN'
    END                                                          AS QUERY_TYPE,
    DB_NAME()                                                    AS QUERY_DATABASE_NAME,
    OBJECT_SCHEMA_NAME(object_id)                                AS QUERY_SCHEMA_NAME,
    query_text                                                   AS QUERY_TEXT,
    NULL                                                         AS QUERY_USER_NAME,
    last_execution_time                                          AS QUERY_START_TIME,
    duration_seconds                                             AS QUERY_DURATION,
    OBJECT_NAME(object_id)                                       AS PROCEDURE_NAME,
    ISNULL(OBJECT_DEFINITION(object_id), OBJECT_NAME(object_id)) AS PROCEDURE_TEXT,
    first_execution_time                                         AS PROCEDURE_START_TIME,
    last_execution_time                                          AS PROCEDURE_END_TIME
FROM proc_statements
WHERE OBJECT_NAME(object_id) IS NOT NULL
ORDER BY PROCEDURE_START_TIME DESC
"""
)

GET_DB_CONFIGS = textwrap.dedent("DBCC USEROPTIONS;")
