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

ORACLE_ALL_TABLE_COMMENTS = textwrap.dedent(
    """
SELECT
	comments table_comment,
	LOWER(table_name) "table_name",
	LOWER(owner) "schema" 	
FROM dba_tab_comments
where comments is not null and owner not in ('SYSTEM', 'SYS')
"""
)


ORACLE_ALL_VIEW_DEFINITIONS = textwrap.dedent(
    """
SELECT
LOWER(view_name) AS "view_name",
LOWER(owner) AS "schema",
DBMS_METADATA.GET_DDL('VIEW', view_name, owner) AS view_def
FROM DBA_VIEWS
WHERE owner NOT IN ('SYSTEM', 'SYS')
UNION ALL
SELECT
LOWER(mview_name) AS "view_name",
LOWER(owner) AS "schema",
DBMS_METADATA.GET_DDL('MATERIALIZED_VIEW', mview_name, owner) AS view_def
FROM DBA_MVIEWS
WHERE owner NOT IN ('SYSTEM', 'SYS')
"""
)

GET_MATERIALIZED_VIEW_NAMES = textwrap.dedent(
    """
SELECT mview_name FROM DBA_MVIEWS WHERE owner = :owner
"""
)

ORACLE_GET_TABLE_NAMES = textwrap.dedent(
    """
SELECT table_name FROM DBA_TABLES WHERE 
{tablespace}
OWNER = :owner  
AND IOT_NAME IS NULL 
AND DURATION IS NULL
AND TABLE_NAME NOT IN 
(SELECT mview_name FROM DBA_MVIEWS WHERE owner = :owner)
"""
)

ORACLE_IDENTITY_TYPE = textwrap.dedent(
    """\
col.default_on_null,
(
	SELECT id.generation_type || ',' || id.IDENTITY_OPTIONS
	FROM DBA_TAB_IDENTITY_COLS{dblink} id
	WHERE col.table_name = id.table_name
	AND col.column_name = id.column_name
	AND col.owner = id.owner
) AS identity_options
"""
)

ORACLE_GET_STORED_PROCEDURES = textwrap.dedent(
    """
SELECT
    OWNER,
    NAME,
    LINE,
    TEXT
FROM
    DBA_SOURCE
WHERE
    type = 'PROCEDURE' and owner = '{schema}'
"""
)

ORACLE_GET_STORED_PROCEDURE_QUERIES = textwrap.dedent(
    """
WITH SP_HISTORY AS (SELECT
	sql_text AS query_text,
    TO_TIMESTAMP(FIRST_LOAD_TIME, 'YYYY-MM-DD HH24:MI:SS') AS start_time,
    TO_TIMESTAMP(LAST_LOAD_TIME, 'YYYY-MM-DD HH24:MI:SS') + NUMTODSINTERVAL(ELAPSED_TIME / 1000, 'SECOND') AS end_time,
    PARSING_SCHEMA_NAME as user_name
  FROM gv$sql
  WHERE sql_text LIKE 'CALL%%'
  AND TO_TIMESTAMP(FIRST_LOAD_TIME, 'YYYY-MM-DD HH24:MI:SS') >= TO_TIMESTAMP('{start_date}', 'YYYY-MM-DD HH24:MI:SS')
 ),
 Q_HISTORY AS (SELECT
      sql_text AS query_text,
      CASE 
      	WHEN UPPER(SQL_TEXT) LIKE 'INSERT%' THEN 'INSERT'
      	WHEN UPPER(SQL_TEXT) LIKE 'SELECT%' THEN 'SELECT'
      	ELSE 'OTHER'
    	END AS QUERY_TYPE,
      TO_TIMESTAMP(FIRST_LOAD_TIME, 'YYYY-MM-DD HH24:MI:SS') AS start_time,
      TO_TIMESTAMP(LAST_LOAD_TIME, 'YYYY-MM-DD HH24:MI:SS') 
      + NUMTODSINTERVAL(ELAPSED_TIME / 1000, 'SECOND') AS end_time,
      PARSING_SCHEMA_NAME AS user_name,
      PARSING_SCHEMA_NAME AS SCHEMA_NAME,
      NULL AS DATABASE_NAME
    FROM gv$sql
    WHERE sql_text NOT LIKE '%CALL%'
      AND SQL_FULLTEXT NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
      AND SQL_FULLTEXT NOT LIKE '/* {{"app": "dbt", %%}} */%%'
      AND TO_TIMESTAMP(FIRST_LOAD_TIME, 'YYYY-MM-DD HH24:MI:SS') 
      >= TO_TIMESTAMP('{start_date}', 'YYYY-MM-DD HH24:MI:SS')
)
SELECT
  Q.QUERY_TYPE AS QUERY_TYPE,
  Q.DATABASE_NAME AS QUERY_DATABASE_NAME,
  Q.SCHEMA_NAME AS QUERY_SCHEMA_NAME,
  SP.QUERY_TEXT AS PROCEDURE_TEXT,
  SP.START_TIME AS PROCEDURE_START_TIME,
  SP.END_TIME AS PROCEDURE_END_TIME,
  Q.START_TIME AS QUERY_START_TIME,
  Q.QUERY_TEXT AS QUERY_TEXT,
  Q.USER_NAME AS QUERY_USER_NAME
FROM SP_HISTORY SP
JOIN Q_HISTORY Q
  ON Q.start_time between SP.start_time and SP.end_time
  AND Q.end_time between SP.start_time and SP.end_time
  AND Q.user_name = SP.user_name
ORDER BY PROCEDURE_START_TIME DESC
"""
)

ORACLE_GET_COLUMNS = textwrap.dedent(
    """
        SELECT
            col.column_name,
            col.data_type,
            col.{char_length_col},
            col.data_precision,
            col.data_scale,
            col.nullable,
            col.data_default,
            com.comments,
            col.virtual_column,
            {identity_cols}
        FROM DBA_TAB_COLS{dblink} col
        LEFT JOIN all_col_comments{dblink} com
        ON col.table_name = com.table_name
        AND col.column_name = com.column_name
        AND col.owner = com.owner
        WHERE col.table_name = CAST(:table_name AS VARCHAR2(128))
        AND col.hidden_column = 'NO'
    """
)

ORACLE_QUERY_HISTORY_STATEMENT = textwrap.dedent(
    """
SELECT 
  NULL AS user_name,
  NULL AS database_name,
  NULL AS schema_name,
  NULL AS aborted,
  SQL_FULLTEXT AS query_text,
  TO_TIMESTAMP(FIRST_LOAD_TIME, 'yy-MM-dd/HH24:MI:SS') AS start_time,
  ELAPSED_TIME / 1000 AS duration,
  TO_TIMESTAMP(FIRST_LOAD_TIME, 'yy-MM-dd/HH24:MI:SS') + NUMTODSINTERVAL(ELAPSED_TIME / 1000000, 'SECOND') AS end_time
FROM gv$sql
WHERE OBJECT_STATUS = 'VALID' 
  {filters}
  AND SQL_FULLTEXT NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
  AND SQL_FULLTEXT NOT LIKE '/* {{"app": "dbt", %%}} */%%'
  AND TO_TIMESTAMP(FIRST_LOAD_TIME, 'yy-MM-dd/HH24:MI:SS') >= TO_TIMESTAMP('{start_time}', 'yy-MM-dd HH24:MI:SS')
  AND TO_TIMESTAMP(FIRST_LOAD_TIME, 'yy-MM-dd/HH24:MI:SS') + NUMTODSINTERVAL(ELAPSED_TIME / 1000000, 'SECOND') 
  < TO_TIMESTAMP('{end_time}', 'yy-MM-dd HH24:MI:SS')
ORDER BY FIRST_LOAD_TIME DESC 
OFFSET 0 ROWS FETCH NEXT {result_limit} ROWS ONLY
"""
)
