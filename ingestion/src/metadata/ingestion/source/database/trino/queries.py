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

TRINO_SQL_STATEMENT = textwrap.dedent(
    """ 
    select "query" as query_text,
      "user" as user_name,
      "started" as start_time,
      "end" as end_time
    from {query_history_table}
    WHERE "query" NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND "query" NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    AND CAST("started" AS date)  >= date_parse('{start_time}', '%Y-%m-%d %H:%i:%s')
    AND CAST("started" AS date) < date_parse('{end_time}', '%Y-%m-%d %H:%i:%s')
    AND "state" = 'FINISHED'
    {filters}
    LIMIT {result_limit}
    """
)

TRINO_TABLE_COMMENTS = textwrap.dedent(
    """
    SELECT "comment" table_comment,
        "schema_name" schema,
        "table_name"
    FROM "system"."metadata"."table_comments"
    WHERE "catalog_name" = '{catalog_name}'
    and "schema_name" = '{schema_name}'
    and "comment" is not null
    """
)

TRINO_GET_DATABASE = """
SHOW CATALOGS
"""
