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

ORACLE_ALL_TABLE_COMMENTS = """
SELECT 
	comments table_comment,
	LOWER(table_name) "table_name",
	LOWER(owner) "schema" 	
FROM all_tab_comments
where comments is not null and owner not in ('SYSTEM', 'SYS')
"""


ORACLE_ALL_VIEW_DEFINITIONS = """
SELECT
LOWER(view_name) AS "view_name",
LOWER(owner) AS "schema",
DBMS_METADATA.GET_DDL('VIEW', view_name, owner) AS view_def
FROM all_views
WHERE owner NOT IN ('SYSTEM', 'SYS')
"""

ORACLE_ALL_MATERIALIZED_VIEW_DEFINITIONS = """
SELECT
LOWER(mview_name) AS "view_name",
LOWER(owner) AS "schema",
DBMS_METADATA.GET_DDL('MATERIALIZED_VIEW', mview_name, owner) AS view_def
FROM all_mviews
WHERE owner NOT IN ('SYSTEM', 'SYS')
"""

GET_MATERIALIZED_VIEW_NAMES = """
SELECT mview_name FROM all_mviews WHERE owner = :owner
"""

ORACLE_GET_TABLE_NAMES = """
SELECT table_name FROM all_tables WHERE 
{tablespace}
OWNER = :owner  
AND IOT_NAME IS NULL 
AND DURATION IS NULL
AND TABLE_NAME NOT IN 
(SELECT mview_name FROM all_mviews WHERE owner = :owner)
"""

ORACLE_IDENTITY_TYPE = """\
col.default_on_null,
(
	SELECT id.generation_type || ',' || id.IDENTITY_OPTIONS
	FROM ALL_TAB_IDENTITY_COLS{dblink} id
	WHERE col.table_name = id.table_name
	AND col.column_name = id.column_name
	AND col.owner = id.owner
) AS identity_options
"""

ORACLE_GET_COLUMNS = """
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
        FROM all_tab_cols{dblink} col
        LEFT JOIN all_col_comments{dblink} com
        ON col.table_name = com.table_name
        AND col.column_name = com.column_name
        AND col.owner = com.owner
        WHERE col.table_name = CAST(:table_name AS VARCHAR2(128))
        AND col.hidden_column = 'NO'
    """
