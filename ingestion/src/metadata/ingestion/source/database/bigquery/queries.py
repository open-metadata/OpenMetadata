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
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, TypeAdapter
from sqlalchemy import text
from sqlalchemy.orm import Session

from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations

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
   total_slot_ms as duration,
   (total_bytes_billed / POWER(2, 40)) * {cost_per_tib} as cost
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
    """SELECT query FROM `region-{region}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
    where creation_time > '{creation_date}' limit 1"""
)


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
    select table_name, table_type from `{project_id}`.{schema_name}.INFORMATION_SCHEMA.TABLES where table_type != 'VIEW'
    """
)

BIGQUERY_TABLE_CONSTRAINTS = textwrap.dedent(
    """
    SELECT * 
    FROM `{project_id}`.{schema_name}.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE 
    WHERE constraint_name LIKE '%pk$';
    """
)

BIGQUERY_FOREIGN_CONSTRAINTS = textwrap.dedent(
    """
    SELECT
      c.table_name AS referred_table,
      r.table_schema as referred_schema,
      r.constraint_name as name,
      c.column_name as referred_columns,
      c.column_name as constrained_columns,
      r.table_name as table_name
    FROM `{project_id}`.{schema_name}.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE c 
    JOIN `{project_id}`.{schema_name}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS r ON c.constraint_name = r.constraint_name 
    WHERE r.constraint_type = 'FOREIGN KEY';
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
    query AS query_text,
    start_time,
    end_time,
    user_email as user_name
  FROM `region-{region}`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
  WHERE statement_type = 'SCRIPT'
    AND creation_time >= '{start_date}'
    AND job_type = "QUERY"
    AND state = "DONE"
    AND error_result is NULL
    AND UPPER(query) LIKE 'CALL%%'
),
Q_HISTORY AS (
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
  WHERE statement_type <> 'SCRIPT'
    AND query NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
    AND query NOT LIKE '/* {{"app": "dbt", %%}} */%%'
    AND creation_time >= '{start_date}'
    AND job_type = "QUERY"
    AND state = "DONE"
    AND error_result is NULL
)
SELECT
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

BIGQUERY_LIFE_CYCLE_QUERY = textwrap.dedent(
    """
select
table_name as table_name,
creation_time as created_at
from `{schema_name}`.INFORMATION_SCHEMA.TABLES
where table_schema = '{schema_name}'
and table_catalog = '{database_name}'
"""
)

BIGQUERY_GET_CHANGED_TABLES_FROM_CLOUD_LOGGING = """
protoPayload.metadata.@type="type.googleapis.com/google.cloud.audit.BigQueryAuditMetadata"
AND (
    protoPayload.methodName = ("google.cloud.bigquery.v2.TableService.UpdateTable" OR "google.cloud.bigquery.v2.TableService.InsertTable" OR "google.cloud.bigquery.v2.TableService.PatchTable" OR "google.cloud.bigquery.v2.TableService.DeleteTable")
    OR
    (protoPayload.methodName = "google.cloud.bigquery.v2.JobService.InsertJob" AND (protoPayload.metadata.tableCreation:* OR protoPayload.metadata.tableChange:* OR protoPayload.metadata.tableDeletion:*))
)
AND resource.labels.project_id = "{project}"
AND resource.labels.dataset_id = "{dataset}"
AND timestamp >= "{start_date}"
"""


class BigQueryQueryResult(BaseModel):
    project_id: str
    dataset_id: str
    table_name: str
    inserted_row_count: Optional[int] = None
    deleted_row_count: Optional[int] = None
    updated_row_count: Optional[int] = None
    start_time: datetime
    statement_type: str

    @staticmethod
    def get_for_table(
        session: Session,
        usage_location: str,
        dataset_id: str,
        project_id: str,
    ):
        rows = session.execute(
            text(
                JOBS.format(
                    usage_location=usage_location,
                    dataset_id=dataset_id,
                    project_id=project_id,
                    insert=DatabaseDMLOperations.INSERT.value,
                    update=DatabaseDMLOperations.UPDATE.value,
                    delete=DatabaseDMLOperations.DELETE.value,
                    merge=DatabaseDMLOperations.MERGE.value,
                )
            )
        )

        return TypeAdapter(List[BigQueryQueryResult]).validate_python(map(dict, rows))


JOBS = """
    SELECT
        statement_type,
        start_time,
        destination_table.project_id as project_id,
        destination_table.dataset_id as dataset_id,
        destination_table.table_id as table_name,
        dml_statistics.inserted_row_count as inserted_row_count,
        dml_statistics.deleted_row_count as deleted_row_count,
        dml_statistics.updated_row_count as updated_row_count
    FROM
        `region-{usage_location}`.INFORMATION_SCHEMA.JOBS
    WHERE
        DATE(creation_time) >= CURRENT_DATE() - 1 AND
        destination_table.dataset_id = '{dataset_id}' AND
        destination_table.project_id = '{project_id}' AND
        statement_type IN (
            '{insert}',
            '{update}',
            '{delete}',
            '{merge}'
        )
    ORDER BY creation_time DESC;
"""
