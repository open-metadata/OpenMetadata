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

from __future__ import annotations

import re
import textwrap
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from pydantic import BaseModel
from sqlalchemy import TIMESTAMP, String, bindparam, text

if TYPE_CHECKING:
    from collections.abc import Generator

    from google.cloud.bigquery.table import TableReference
    from sqlalchemy.orm import Session

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
    select table_name, table_type from `{project_id}`.{schema_name}.INFORMATION_SCHEMA.TABLES 
    WHERE TRUE {view_filter}
    """  # noqa: W291
)

BIGQUERY_CONSTRAINTS = textwrap.dedent(
    """
    SELECT
        kcu.constraint_name,
        kcu.table_catalog,
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        tc.constraint_type,
        ccu.table_catalog AS referenced_catalog,
        ccu.table_schema AS referenced_schema,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
    FROM `{project_id}`.`{dataset_name}`.INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
    JOIN `{project_id}`.`{dataset_name}`.INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE AS ccu
        ON kcu.constraint_catalog = ccu.constraint_catalog
        AND kcu.constraint_schema = ccu.constraint_schema
        AND kcu.constraint_name = ccu.constraint_name
    JOIN `{project_id}`.`{dataset_name}`.INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc
        ON tc.constraint_catalog = ccu.constraint_catalog
        AND tc.constraint_schema = ccu.constraint_schema
        AND tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
    """
)

BIGQUERY_GET_STORED_PROCEDURES = textwrap.dedent(
    """
SELECT
  routine_name as name,
  routine_definition as definition,
  external_language as language
FROM `{database_name}`.`{schema_name}`.INFORMATION_SCHEMA.ROUTINES
WHERE routine_type in ('PROCEDURE', 'TABLE FUNCTION', 'FUNCTION')
  AND routine_catalog = '{database_name}'
  AND routine_schema = '{schema_name}'
    """
)

BIGQUERY_GET_STORED_PROCEDURES_BY_REGION = textwrap.dedent(
    """
SELECT
  routine_name as name,
  routine_definition as definition,
  external_language as language
FROM `{database_name}`.`region-{region}`.INFORMATION_SCHEMA.ROUTINES
WHERE routine_type in ('PROCEDURE', 'TABLE FUNCTION', 'FUNCTION')
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
table_type as table_type,
creation_time as created_at
from `{database_name}`.`{schema_name}`.INFORMATION_SCHEMA.TABLES
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
AND timestamp >= "{start_date}"
AND timestamp < "{end_date}"
{dataset_filter}
"""

BIGQUERY_GET_SCHEMA_NAMES = """
SELECT schema_name FROM `{project}`.`region-{region}`.INFORMATION_SCHEMA.SCHEMATA;
"""

BIGQUERY_GET_VIEW_NAMES = """
SELECT table_name FROM `{project}`.`{dataset}`.INFORMATION_SCHEMA.VIEWS;
"""

BIGQUERY_GET_MATERIALIZED_VIEW_NAMES = """
SELECT table_name FROM `{project}`.`{dataset}`.INFORMATION_SCHEMA.MATERIALIZED_VIEWS;
"""

BIGQUERY_GET_TABLE_DDLS = textwrap.dedent(
    """
    SELECT table_name, ddl
    FROM `{database_name}`.`{schema_name}`.INFORMATION_SCHEMA.TABLES
    WHERE table_schema = '{schema_name}'
      AND table_catalog = '{database_name}'
      AND table_type IN ('BASE TABLE', 'EXTERNAL')
    """
)

BIGQUERY_GET_TABLE_DDLS_BY_REGION = textwrap.dedent(
    """
    SELECT table_name, ddl
    FROM `{database_name}`.`region-{region}`.INFORMATION_SCHEMA.TABLES
    WHERE table_schema = '{schema_name}'
      AND table_catalog = '{database_name}'
      AND table_type IN ('BASE TABLE', 'EXTERNAL')
    """
)


MAX_SYSTEM_METRICS_JOBS = 50_000
_PROJECT_ID = re.compile(r"(?:[A-Za-z0-9][A-Za-z0-9.-]*:)?[A-Za-z0-9][A-Za-z0-9_-]*")
_LOCATION = re.compile(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")


def _jobs_view(project: str, location: str) -> str:
    if not _PROJECT_ID.fullmatch(project):
        raise ValueError(f"Invalid BigQuery jobs project ID: {project!r}")
    return f"`{project}`.`region-{location}`.INFORMATION_SCHEMA.JOBS"


class BigQueryQueryResult(BaseModel):
    job_project: str
    job_id: str
    start_time: datetime
    inserted_row_count: int | None = None
    deleted_row_count: int | None = None
    updated_row_count: int | None = None

    @classmethod
    def get_for_table(
        cls,
        session: Session,
        destination: TableReference,
        job_projects: tuple[str, ...],
        location: str,
        window_start: datetime,
        window_end: datetime,
    ) -> Generator[BigQueryQueryResult, None, None]:
        """Stream completed DML for one destination across all configured jobs views."""
        if not _LOCATION.fullmatch(location):
            raise ValueError(f"Invalid BigQuery jobs location: {location!r}")

        union = "\nUNION ALL\n".join(
            JOBS.format(jobs_view=_jobs_view(project, location.lower())) for project in job_projects
        )
        statement = text(f"{union}\nLIMIT {MAX_SYSTEM_METRICS_JOBS + 1}").bindparams(
            bindparam("project_id", type_=String()),
            bindparam("dataset_id", type_=String()),
            bindparam("table_id", type_=String()),
            bindparam("creation_lower_bound", type_=TIMESTAMP(timezone=True)),
            bindparam("window_start", type_=TIMESTAMP(timezone=True)),
            bindparam("window_end", type_=TIMESTAMP(timezone=True)),
        )
        parameters = {
            "project_id": destination.project,
            "dataset_id": destination.dataset_id,
            "table_id": destination.table_id,
            # A query can wait up to 48 hours before its start_time becomes eligible.
            "creation_lower_bound": window_start - timedelta(hours=48),
            "window_start": window_start,
            "window_end": window_end,
        }
        with session.execute(statement, parameters) as rows:
            yield from (cls.model_validate(row) for row in rows.mappings())


JOBS = """
    SELECT
        project_id AS job_project,
        job_id,
        start_time,
        dml_statistics.inserted_row_count AS inserted_row_count,
        dml_statistics.deleted_row_count AS deleted_row_count,
        dml_statistics.updated_row_count AS updated_row_count
    FROM
        {jobs_view}
    WHERE
        creation_time >= :creation_lower_bound
        AND creation_time < :window_end
        AND start_time >= :window_start
        AND start_time < :window_end
        AND destination_table.project_id = :project_id
        AND destination_table.dataset_id = :dataset_id
        AND destination_table.table_id = :table_id
        AND job_type = 'QUERY'
        AND state = 'DONE'
        AND error_result IS NULL
        AND statement_type IN ('INSERT', 'UPDATE', 'DELETE', 'MERGE')
"""
