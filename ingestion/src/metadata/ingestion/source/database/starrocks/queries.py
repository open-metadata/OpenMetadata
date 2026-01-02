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
SQL Queries used during ingestion for StarRocks

Note: SHOW commands (SHOW FULL COLUMNS, SHOW PARTITIONS) use string formatting
with backtick-quoted identifiers because MySQL-style SHOW commands don't support
parameterized queries. The identifiers come from database metadata, not user input.
"""

import textwrap

STARROCKS_GET_TABLE_NAMES = textwrap.dedent(
    """
    SELECT TABLE_NAME as name, TABLE_TYPE as table_type
    FROM INFORMATION_SCHEMA.tables
    WHERE TABLE_SCHEMA = :schema
    """
)

STARROCKS_SHOW_FULL_COLUMNS = textwrap.dedent(
    """
SHOW FULL COLUMNS FROM `{}`.`{}`
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

STARROCKS_VIEW_DEFINITIONS = textwrap.dedent(
    """
SELECT
    TABLE_NAME as view_name,
    TABLE_SCHEMA as schema,
    VIEW_DEFINITION as view_def
FROM information_schema.views
WHERE TABLE_SCHEMA = :schema
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
    queryId as query_id,
    `user` as user_name,
    queryType as query_type,
    `db` as database_name,
    `sql` as query_text,
    queryStartTime as start_time,
    TIMESTAMPADD(MILLISECOND, queryTime, queryStartTime) as end_time,
    queryTime as duration,
    scanRows as scan_rows,
    scanBytes as scan_bytes
FROM starrocks_audit_db__.starrocks_audit_tbl__
WHERE queryStartTime >= '{start_time}'
    AND queryStartTime < '{end_time}'
    AND `sql` NOT LIKE '%/* {{"app": "OpenMetadata", %}} */%'
    AND `sql` NOT LIKE '%/* {{"app": "dbt", %}} */%'
    {filters}
ORDER BY queryStartTime DESC
LIMIT {result_limit}
"""
)

STARROCKS_TEST_GET_QUERIES = textwrap.dedent(
    """
SELECT `sql` FROM starrocks_audit_db__.starrocks_audit_tbl__ LIMIT 1
"""
)
