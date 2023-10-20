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

BIGQUERY_STATEMENT = textwrap.dedent(
    """
 SELECT
   project_id as database_name,
   user_email as user_name,
   statement_type as query_type,
   start_time,
   end_time,
   query as query_text,
   null as schema_name,
   total_slot_ms/1000 as duration
FROM `region-{region}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time BETWEEN "{start_time}" AND "{end_time}"
  {filters}
  AND job_type = "QUERY"
  AND state = "DONE"
  AND IFNULL(statement_type, "NO") not in ("NO", "DROP_TABLE")
  AND query NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
  AND query NOT LIKE '/* {{"app": "dbt", %%}} */%%'
  LIMIT {result_limit}
"""
)

BIGQUERY_TEST_STATEMENT = textwrap.dedent(
    """SELECT query FROM `region-{region}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT limit 1"""
)

BIGQUERY_GET_SCHEMA_NAME = """
select schema_name from {project_id}.INFORMATION_SCHEMA.SCHEMATA {schema_filter}
"""

BIGQUERY_SCHEMA_DESCRIPTION = textwrap.dedent(
    """
    SELECT option_value as schema_description FROM
    `{project_id}`.`region-{region}`.INFORMATION_SCHEMA.SCHEMATA_OPTIONS 
    where schema_name = '{schema_name}' and option_name = 'description' 
    and option_value is not null
    """
)

BIGQUERY_TABLE_AND_TYPE = textwrap.dedent(
    """
    select table_name, table_type 
    from `{project_id}`.{schema_name}.INFORMATION_SCHEMA.TABLES 
    where table_type != 'VIEW' {table_filter}
    """
)

BIGQUERY_GET_STORED_PROCEDURES = textwrap.dedent(
    """
SELECT 
  routine_name as name,
  routine_definition as definition,
  external_language as language
FROM `{schema_name}`.INFORMATION_SCHEMA.ROUTINES
WHERE routine_type in ('PROCEDURE', 'TABLE FUNCTION')
  AND routine_catalog = '{database_name}'
  AND routine_schema = '{schema_name}'
    """
)

BIGQUERY_GET_STORED_PROCEDURE_QUERIES = textwrap.dedent(
    """
WITH SP_HISTORY AS (
  SELECT
    job_id,
    query AS query_text,
    start_time,
    end_time,
    user_email as user_name
  FROM `region-{region}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
  WHERE statement_type = 'SCRIPT'
    AND start_time >= '{start_date}'
    AND job_type = "QUERY"
    AND state = "DONE"
    AND error_result is NULL
    AND query LIKE 'CALL%%'
),
Q_HISTORY AS (
  SELECT
    job_id,
    project_id as database_name,
    user_email as user_name,
    statement_type as query_type,
    start_time,
    end_time,
    query as query_text,
    null as schema_name,
    total_slot_ms/1000 as duration
  FROM `region-{region}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
  WHERE statement_type <> 'SCRIPT'
    AND query NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND query NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    AND start_time >= '{start_date}' 
    AND job_type = "QUERY"
    AND state = "DONE"
    AND error_result is NULL
)
SELECT
  SP.job_id as procedure_id,
  Q.job_id as query_id,
  Q.query_type as query_type,
  SP.query_text as procedure_text,
  Q.query_text as query_text,
  null as query_database_name,
  null as query_schema_name,
  SP.start_time as procedure_start_time,
  SP.end_time as procedure_end_time,
  Q.start_time as query_start_time,
  Q.end_time as query_end_time,
  Q.duration as query_duration,
  Q.user_name as query_user_name
FROM SP_HISTORY SP
JOIN Q_HISTORY Q
  ON Q.start_time between SP.start_time and SP.end_time
  AND Q.end_time between SP.start_time and SP.end_time
  AND Q.user_name = SP.user_name
ORDER BY procedure_start_time DESC
"""
)
