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

STARROCKS_GET_SCHEMA_COLUMN_INFO = textwrap.dedent(
    """
SELECT COLUMN_NAME,COLUMN_DEFAULT,IS_NULLABLE,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,
NUMERIC_PRECISION,NUMERIC_SCALE,COLUMN_TYPE,COLUMN_KEY,COLUMN_COMMENT,ORDINAL_POSITION
from information_schema.`columns` t
where TABLE_SCHEMA = :schema
AND TABLE_NAME = :table_name
    """
)

STARROCKS_SHOW_FULL_COLUMNS = textwrap.dedent(
    """
SHOW FULL COLUMNS FROM `{}`.`{}`
    """
)

STARROCKS_GET_TABLE_NAMES = textwrap.dedent(
    """
    select TABLE_NAME as name,
    case when `ENGINE` = 'StarRocks' and TABLE_TYPE = 'VIEW' then 'MVIEW'
         when `ENGINE` = 'MEMORY' and TABLE_TYPE = 'SYSTEM VIEW' then 'VIEW'
         when `ENGINE` = 'StarRocks' and TABLE_TYPE = 'TABLE' then 'TABLE'
         when (`ENGINE` = '' OR `ENGINE` IS NULL) and TABLE_TYPE = 'VIEW' then 'VIEW'
         else `ENGINE`
    end as engine
    from INFORMATION_SCHEMA.tables
    where TABLE_SCHEMA = :schema
    """
)

STARROCKS_TABLE_COMMENTS = textwrap.dedent(
    """
SELECT TABLE_COMMENT
FROM information_schema.tables
WHERE TABLE_SCHEMA = :schema
AND TABLE_NAME = :table_name
"""
)

STARROCKS_PARTITION_DETAILS = textwrap.dedent(
    """
SHOW PARTITIONS FROM `{}`.`{}`
    """
)

STARROCKS_SQL_STATEMENT = textwrap.dedent(
    """
    SELECT
        `timestamp` AS start_time,
        DATE_ADD(`timestamp`, INTERVAL queryTime/1000 SECOND) AS end_time,
        queryTime AS duration,
        db AS database_name,
        db AS schema_name,
        user AS user_name,
        state != 'EOF' AS aborted,
        queryId AS query_id,
        stmt AS query_text
    FROM starrocks_audit_db__.starrocks_audit_tbl__
    WHERE `timestamp` >= '{start_time}'
      AND `timestamp` < '{end_time}'
      AND stmt NOT LIKE '%/* {{"app": "OpenMetadata",%}} */%'
      AND stmt NOT LIKE '%/* {{"app": "dbt",%}} */%'
      {filters}
    ORDER BY `timestamp` DESC
    LIMIT {result_limit}
    """
)

STARROCKS_SQL_STATEMENT_TEST = textwrap.dedent(
    """
    SELECT
        `timestamp` AS start_time,
        queryTime AS duration,
        db AS database_name,
        user AS user_name,
        stmt AS query_text
    FROM starrocks_audit_db__.starrocks_audit_tbl__
    LIMIT 1
    """
)
