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
FROM sys.tables AS obj
LEFT JOIN sys.extended_properties AS ep
    ON obj.object_id = ep.major_id AND ep.minor_id = 0
JOIN sys.schemas AS s
    ON obj.schema_id = s.schema_id
WHERE ep.name = 'MS_Description'
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
      CROSS APPLY sys.Dm_exec_sql_text(p.plan_handle) AS t
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
