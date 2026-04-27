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
SQL Queries for Microsoft Fabric metadata extraction
"""

import textwrap

# Query to get all databases (warehouses/lakehouses) in the Fabric workspace
# Note: In Fabric, each warehouse/lakehouse appears as a database
FABRIC_GET_DATABASES = """
SELECT name
FROM sys.databases
WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
ORDER BY name
"""

# Query to get stored procedures
FABRIC_GET_STORED_PROCEDURES = """
SELECT
    o.name AS name,
    m.definition AS definition,
    CASE
        WHEN o.type = 'P' THEN 'SQL'
        WHEN o.type = 'PC' THEN 'CLR'
        ELSE 'UNKNOWN'
    END AS language
FROM [{database_name}].sys.objects o
JOIN [{database_name}].sys.sql_modules m ON o.object_id = m.object_id
WHERE o.type IN ('P', 'PC')
AND SCHEMA_NAME(o.schema_id) = '{schema_name}'
ORDER BY o.name
"""

# Query to get table comments (extended properties)
FABRIC_GET_TABLE_COMMENTS = """
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    CAST(ep.value AS NVARCHAR(MAX)) AS comment
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
LEFT JOIN sys.extended_properties ep
    ON ep.major_id = t.object_id
    AND ep.minor_id = 0
    AND ep.name = 'MS_Description'
WHERE s.name = '{schema_name}'
"""

FABRIC_SQL_STATEMENT = textwrap.dedent(
    """
SELECT TOP {result_limit}
    DB_NAME()                          AS database_name,
    h.command                          AS query_text,
    h.start_time                       AS start_time,
    h.end_time                         AS end_time,
    h.total_elapsed_time_ms / 1000.0   AS duration,
    NULL                               AS schema_name,
    CASE
        WHEN h.command LIKE '%MERGE%'         THEN 'MERGE'
        WHEN h.command LIKE '%UPDATE%'        THEN 'UPDATE'
        WHEN h.command LIKE '%SELECT%INTO%'   THEN 'CREATE_TABLE_AS_SELECT'
        WHEN h.command LIKE '%INSERT%'        THEN 'INSERT'
        ELSE 'UNKNOWN'
    END AS query_type,
    h.login_name                       AS user_name,
    CASE WHEN h.status = 'Failed' THEN 1 ELSE 0 END AS aborted
FROM queryinsights.exec_requests_history AS h
WHERE h.start_time BETWEEN '{start_time}' AND '{end_time}'
  AND h.command NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
  AND h.command NOT LIKE '/* {{"app": "dbt", %%}} */%%'
  {filters}
ORDER BY h.start_time DESC;
"""
)

FABRIC_GET_STORED_PROCEDURE_QUERIES = textwrap.dedent(
    """
SELECT
    h.status                                AS REQUEST_STATUS,
    h.start_time                            AS SUBMIT_TIME,
    h.start_time                            AS PROCEDURE_START_TIME,
    h.start_time                            AS QUERY_START_TIME,
    h.end_time                              AS PROCEDURE_END_TIME,
    h.total_elapsed_time_ms                 AS TOTAL_ELAPSED_TIME,
    h.command                               AS QUERY_TEXT,
    h.command                               AS PROCEDURE_TEXT,
    CASE
        WHEN h.command LIKE '%MERGE%'        THEN 'MERGE'
        WHEN h.command LIKE '%UPDATE%'       THEN 'UPDATE'
        WHEN h.command LIKE '%SELECT%INTO%'  THEN 'CREATE_TABLE_AS_SELECT'
        WHEN h.command LIKE '%INSERT%'       THEN 'INSERT'
        ELSE 'UNKNOWN'
    END                                     AS QUERY_TYPE,
    h.login_name                            AS QUERY_USER_NAME,
    DB_NAME()                               AS QUERY_DATABASE_NAME,
    NULL                                    AS QUERY_SCHEMA_NAME,
    CASE
        WHEN LOWER(h.command) LIKE 'exec%' THEN
            LOWER(
                CASE
                    WHEN CHARINDEX('.', p.proc_name) > 0
                        THEN RIGHT(p.proc_name, LEN(p.proc_name) - CHARINDEX('.', p.proc_name))
                    ELSE p.proc_name
                END
            )
        ELSE NULL
    END                                     AS PROCEDURE_NAME,
    h.total_elapsed_time_ms / 1000.0          AS QUERY_DURATION
FROM queryinsights.exec_requests_history h
CROSS APPLY (
    SELECT
        LEFT(
            LTRIM(SUBSTRING(h.command, CHARINDEX(' ', h.command) + 1, LEN(h.command))),
            CHARINDEX(' ', LTRIM(SUBSTRING(h.command, CHARINDEX(' ', h.command) + 1, LEN(h.command))) + ' ') - 1
        ) AS proc_name
) p
WHERE LOWER(h.command) LIKE 'exec%'
  AND h.end_time > CONVERT(DATETIME2, '{start_date}', 120)
ORDER BY h.start_time DESC;
"""
)

# Query to get column comments
FABRIC_GET_COLUMN_COMMENTS = """
SELECT
    c.name AS column_name,
    CAST(ep.value AS NVARCHAR(MAX)) AS comment
FROM sys.columns c
JOIN sys.tables t ON c.object_id = t.object_id
JOIN sys.schemas s ON t.schema_id = s.schema_id
LEFT JOIN sys.extended_properties ep
    ON ep.major_id = c.object_id
    AND ep.minor_id = c.column_id
    AND ep.name = 'MS_Description'
WHERE s.name = '{schema_name}'
AND t.name = '{table_name}'
"""
