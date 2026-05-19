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

# general_log.argument and slow_log.sql_text are MEDIUMTEXT on older MySQL and MEDIUMBLOB on 5.7+;
# CONVERT(... USING utf8mb4) unifies behavior for SELECT/WHERE.
MYSQL_SQL_STATEMENT = textwrap.dedent(
    """
SELECT 
	NULL `database_name`,
	CONVERT(argument USING utf8mb4) `query_text`,
	event_time `start_time`,
    NULL `end_time`,
	NULL `duration`,
	NULL `schema_name`,
    NULL `query_type`,
    NULL `user_name`,
    NULL `aborted`
FROM mysql.general_log
WHERE command_type = 'Query' 
    AND event_time between '{start_time}' and '{end_time}'
    AND CONVERT(argument USING utf8mb4) NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND CONVERT(argument USING utf8mb4) NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    {filters}
ORDER BY event_time desc
LIMIT {result_limit};
"""  # noqa: W291
)


MYSQL_SQL_STATEMENT_SLOW_LOGS = textwrap.dedent(
    """
SELECT 
	NULL `database_name`,
	CONVERT(sql_text USING utf8mb4) `query_text`,
	start_time `start_time`,
    NULL `end_time`,
	NULL  `duration`,
	NULL `schema_name`,
    NULL `query_type`,
    NULL `user_name`,
    NULL `aborted`
FROM mysql.slow_log
WHERE start_time between '{start_time}' and '{end_time}'
    AND CONVERT(sql_text USING utf8mb4) NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND CONVERT(sql_text USING utf8mb4) NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    {filters}
ORDER BY start_time desc
LIMIT {result_limit};
"""  # noqa: W291
)

MYSQL_TEST_GET_QUERIES = textwrap.dedent(
    """
SELECT CONVERT(argument USING utf8mb4) AS query_text FROM mysql.general_log LIMIT 1;
"""
)

MYSQL_TEST_GET_QUERIES_SLOW_LOGS = textwrap.dedent(
    """
SELECT CONVERT(sql_text USING utf8mb4) AS query_text FROM mysql.slow_log LIMIT 1;
"""
)

MYSQL_GET_ROUTINES = """
    SELECT 
    ROUTINE_NAME AS routine_name,
    ROUTINE_SCHEMA AS schema_name,
    ROUTINE_DEFINITION AS definition,
    ROUTINE_TYPE AS routine_type,
    ROUTINE_COMMENT AS description
FROM information_schema.ROUTINES
WHERE ROUTINE_TYPE IN ('PROCEDURE', 'FUNCTION')
AND ROUTINE_SCHEMA = '{schema_name}';
"""  # noqa: W291
