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

MYSQL_SQL_STATEMENT = textwrap.dedent(
    """
SELECT 
	NULL `database_name`,
	argument `query_text`,
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
    AND argument NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND argument NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    {filters}
ORDER BY event_time desc
LIMIT {result_limit};
"""
)


MYSQL_TEST_GET_QUERIES = textwrap.dedent(
    """
SELECT `argument` from mysql.general_log limit 1;
"""
)
