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
Queries on the Dremio job history, read by the usage and lineage workflows
"""

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime, timezone

from metadata.generated.schema.type.basic import DateTime
from metadata.generated.schema.type.tableQuery import TableQuery


@dataclass(frozen=True)
class JobsTable:
    """Where an edition keeps its job history, and the unit of its epoch columns"""

    name: str
    time_column: str
    cpu_column: str
    units_per_second: int


# `sys."jobs"` of Dremio Software only lists the jobs that are running;
# finished ones are in `sys.jobs_recent`.
CLOUD_JOBS = JobsTable("sys.project.history.jobs", "submitted_epoch", "execution_cpu_time_ns", 1_000_000_000)
SOFTWARE_JOBS = JobsTable("sys.jobs_recent", "submitted_epoch_millis", "execution_cpu_time_millis", 1_000)

USAGE_FILTER = "UPPER(query) LIKE '%SELECT%'"

LINEAGE_FILTER = """(
    UPPER(query) LIKE '%CREATE%TABLE%AS%SELECT%'
    OR UPPER(query) LIKE '%INSERT%INTO%'
    OR UPPER(query) LIKE '%UPDATE%'
    OR UPPER(query) LIKE '%MERGE%'
    OR UPPER(query) LIKE '%CREATE%VIEW%'
)"""

TEST_GET_JOBS = "SELECT job_id FROM {jobs_table} LIMIT 1"


def get_jobs_query(
    jobs: JobsTable, start_time: datetime, end_time: datetime, query_filter: str, result_limit: int | None
) -> str:
    """
    The user queries submitted between the two times, newest first. Reads of the
    job history itself, such as this query, are left out.
    """
    start = int(start_time.timestamp() * jobs.units_per_second)
    end = int(end_time.timestamp() * jobs.units_per_second)
    return f"""
SELECT
    query,
    user_name,
    {jobs.time_column} AS submitted_epoch,
    {jobs.cpu_column} AS cpu_time
FROM {jobs.name}
WHERE {jobs.time_column} >= {start}
  AND {jobs.time_column} < {end}
  AND query_type IN ('UI_RUN', 'JDBC', 'ODBC', 'REST', 'FLIGHT')
  AND query IS NOT NULL
  AND LOWER(query) NOT LIKE '%{jobs.name.lower()}%'
  AND {query_filter}
ORDER BY {jobs.time_column} DESC
{f"LIMIT {result_limit}" if result_limit else ""}
"""


def to_table_query(row: dict, jobs: JobsTable, service_name: str) -> TableQuery:
    """
    The usage stage counts a query on the day of its `analysisDate`, so it is
    the day the job was submitted, not the day of the run.
    """
    submitted = row.get("submitted_epoch")
    cpu_time = row.get("cpu_time")
    submitted_at = datetime.fromtimestamp(submitted / jobs.units_per_second, tz=timezone.utc) if submitted else None
    return TableQuery(
        query=row["query"],
        userName=row.get("user_name") or "",
        startTime=submitted_at.isoformat() if submitted_at else "",
        duration=cpu_time / jobs.units_per_second if cpu_time else 0,
        analysisDate=DateTime(submitted_at or datetime.now(tz=timezone.utc)),
        serviceName=service_name,
    )


def iter_table_queries(rows: list[dict], jobs: JobsTable, service_name: str) -> Iterator[TableQuery]:
    for row in rows:
        if row.get("query"):
            yield to_table_query(row, jobs, service_name)
