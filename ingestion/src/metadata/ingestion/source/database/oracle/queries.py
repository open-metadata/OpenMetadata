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

ORACLE_ALL_TABLE_COMMENTS = textwrap.dedent(
    """
SELECT
	comments table_comment,
	LOWER(table_name) "table_name",
	LOWER(owner) "schema" 	
FROM DBA_TAB_COMMENTS
where comments is not null and owner not in ('SYSTEM', 'SYS')
"""
)


ORACLE_ALL_VIEW_DEFINITIONS = textwrap.dedent(
    """
SELECT
LOWER(view_name) AS "view_name",
LOWER(owner) AS "schema",
text AS view_def
FROM DBA_VIEWS
WHERE owner NOT IN ('SYSTEM', 'SYS')
UNION ALL
SELECT
LOWER(mview_name) AS "view_name",
LOWER(owner) AS "schema",
query AS view_def
FROM DBA_MVIEWS
WHERE owner NOT IN ('SYSTEM', 'SYS')
"""
)

GET_VIEW_NAMES = textwrap.dedent(
    """
SELECT view_name FROM DBA_VIEWS WHERE owner = :owner
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
    TEXT,
    'StoredProcedure' as procedure_type
FROM
    DBA_SOURCE
WHERE
    type = 'PROCEDURE' and owner = '{schema}'
"""
)
ORACLE_GET_SCHEMA = """
    SELECT USERNAME AS SCHEMA_NAME 
    FROM ALL_USERS 
    WHERE ROWNUM = 1 
    ORDER BY USERNAME
"""
ORACLE_GET_STORED_PACKAGES = textwrap.dedent(
    """
SELECT
    OWNER,
    NAME,
    LINE,
    TEXT,
    'StoredPackage' as procedure_type

FROM
    DBA_SOURCE
WHERE TYPE IN ('PACKAGE', 'PACKAGE BODY') AND owner = '{schema}'
"""
)
CHECK_ACCESS_TO_ALL = "SELECT table_name FROM DBA_TABLES where ROWNUM < 2"
ORACLE_GET_STORED_PROCEDURE_QUERIES = textwrap.dedent(
    """
WITH SP_HISTORY AS (SELECT
	sql_text AS query_text,
    TO_TIMESTAMP(FIRST_LOAD_TIME, 'YYYY-MM-DD HH24:MI:SS') AS start_time,
    TO_TIMESTAMP(LAST_LOAD_TIME, 'YYYY-MM-DD HH24:MI:SS') + NUMTODSINTERVAL(ELAPSED_TIME / 1000, 'SECOND') AS end_time,
    PARSING_SCHEMA_NAME as user_name
  FROM gv$sql
  WHERE UPPER(sql_text) LIKE '%%CALL%%' or UPPER(sql_text) LIKE '%%BEGIN%%'
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
    WHERE UPPER(sql_text) NOT LIKE '%%CALL%%' AND UPPER(sql_text) NOT LIKE '%%BEGIN%%'
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
  AND Q.QUERY_TYPE <> 'SELECT'
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
        LEFT JOIN DBA_COL_COMMENTS{dblink} com
        ON col.table_name = com.table_name
        AND col.column_name = com.column_name
        AND col.owner = com.owner
        WHERE col.table_name = CAST(:table_name AS VARCHAR2(128))
        AND col.hidden_column = 'NO'
    """
)

ORACLE_ALL_CONSTRAINTS = textwrap.dedent(
    """
        SELECT
            ac.constraint_name,
            ac.constraint_type,
            loc.column_name AS local_column,
            rem.table_name AS remote_table,
            rem.column_name AS remote_column,
            rem.owner AS remote_owner,
            loc.position as loc_pos,
            rem.position as rem_pos,
            ac.search_condition,
            ac.delete_rule
        FROM DBA_CONSTRAINTS{dblink} ac,
            DBA_CONS_COLUMNS{dblink} loc,
            DBA_CONS_COLUMNS{dblink} rem
        WHERE ac.table_name = CAST(:table_name AS VARCHAR2(128))
            AND ac.constraint_type IN ('R','P', 'U', 'C')
            AND ac.owner = CAST(:owner AS VARCHAR2(128))
            AND ac.owner = loc.owner
            AND ac.constraint_name = loc.constraint_name
            AND ac.r_owner = rem.owner(+)
            AND ac.r_constraint_name = rem.constraint_name(+)
            AND (rem.position IS NULL or loc.position=rem.position)
        ORDER BY ac.constraint_name, loc.position
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
