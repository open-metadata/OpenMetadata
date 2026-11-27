"""BigQuery system metric source"""

from __future__ import annotations

from contextlib import closing
from datetime import datetime, time, timedelta, timezone
from typing import TYPE_CHECKING

from metadata.generated.schema.entity.data.table import DmlOperationType, SystemProfile
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.source.database.bigquery.queries import (
    MAX_SYSTEM_METRICS_JOBS,
    BigQueryQueryResult,
)
from metadata.profiler.metrics.system.system import (
    SystemMetricsComputer,
    register_system_metrics,
)
from metadata.profiler.orm.registry import PythonDialects
from metadata.utils.time_utils import datetime_to_timestamp

if TYPE_CHECKING:
    from google.cloud.bigquery.table import TableReference
    from sqlalchemy.orm import Session

    from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import BigQueryConnection

MAX_SYSTEM_PROFILE_BINS = 10_000
# The backend deserializes rowsAffected as a signed Java Integer.
MIN_ROWS_AFFECTED = -(2**31)
MAX_ROWS_AFFECTED = 2**31 - 1


@register_system_metrics(PythonDialects.BigQuery)
class BigQuerySystemMetricsComputer(SystemMetricsComputer):
    """Collect DML row effects for a physical BigQuery table."""

    def __init__(
        self,
        session: Session,
        destination: TableReference,
        connection: BigQueryConnection,
        run_started_at: datetime,
    ):
        self.session = session
        self.destination = destination
        self.location = connection.usageLocation or "us"
        self.job_projects = tuple(
            dict.fromkeys(
                (connection.billingProjectId or destination.project, *(connection.systemMetricsJobProjectIds or ()))
            )
        )
        utc_date = run_started_at.astimezone(timezone.utc).date()
        self.window_end = datetime.combine(utc_date + timedelta(days=1), time.min, tzinfo=timezone.utc)
        self.window_start = self.window_end - timedelta(days=connection.systemMetricsLookbackDays or 2)

    def get_system_metrics(self) -> list[SystemProfile]:
        """Publish bins only after the complete, bounded jobs scan succeeds."""
        try:
            bins = self._collect_bins()
        except Exception as exc:
            projects = ", ".join(self.job_projects)
            raise RuntimeError(
                f"BigQuery system metrics for {self.destination} in {self.location} across {projects} failed: {exc}"
            ) from exc

        return [
            SystemProfile(timestamp=Timestamp(timestamp), operation=DmlOperationType(operation), rowsAffected=count)
            for (timestamp, operation), count in sorted(bins.items())
        ]

    def _collect_bins(self) -> dict[tuple[int, str], int]:
        seen_jobs: dict[tuple[str, str, str], BigQueryQueryResult] = {}
        bins: dict[tuple[int, str], int] = {}
        with closing(
            BigQueryQueryResult.get_for_table(
                self.session, self.destination, self.job_projects, self.location, self.window_start, self.window_end
            )
        ) as rows:
            for row_number, job in enumerate(rows, 1):
                if row_number > MAX_SYSTEM_METRICS_JOBS:
                    raise ValueError(f"More than {MAX_SYSTEM_METRICS_JOBS:,} BigQuery DML jobs match this table")
                identity = (self.location, job.job_project, job.job_id)
                if identity in seen_jobs:
                    if seen_jobs[identity] != job:
                        raise ValueError(f"Conflicting records for BigQuery job {job.job_project}:{job.job_id}")
                    continue
                seen_jobs[identity] = job
                self._add_row_effects(job, bins)
                if len(bins) > MAX_SYSTEM_PROFILE_BINS:
                    raise ValueError(
                        f"More than {MAX_SYSTEM_PROFILE_BINS:,} BigQuery system profile bins match this table"
                    )
        return bins

    @staticmethod
    def _add_row_effects(job: BigQueryQueryResult, bins: dict[tuple[int, str], int]) -> None:
        timestamp = datetime_to_timestamp(job.start_time, milliseconds=True)
        effects = (
            (DmlOperationType.INSERT, job.inserted_row_count),
            (DmlOperationType.UPDATE, job.updated_row_count),
            (DmlOperationType.DELETE, job.deleted_row_count),
        )
        for operation, count in effects:
            if count is None:
                continue
            if not MIN_ROWS_AFFECTED <= count <= MAX_ROWS_AFFECTED:
                raise ValueError(f"BigQuery {operation.value} row count {count} is outside the rowsAffected range")
            if count > 0:
                # The profile API replaces rows with the same timestamp and operation.
                key = (timestamp, operation.value)
                total = bins.get(key, 0) + count
                if total > MAX_ROWS_AFFECTED:
                    raise ValueError(f"BigQuery {operation.value} row total {total} exceeds the rowsAffected range")
                bins[key] = total
