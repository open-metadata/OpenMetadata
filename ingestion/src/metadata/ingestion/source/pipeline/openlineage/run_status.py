#  Copyright 2026 Collate
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
Pipeline run status and tasks built from OpenLineage run events.

A pipeline run is an event without a parent facet, such as a Spark application or
an Airflow DAG run. Its own events and those of the jobs it runs directly (Spark SQL
jobs, Airflow tasks) are merged into one status row with one task line per job. The
row is keyed by the time embedded in the run's UUIDv7 runId, so every event of the
run finds the same row whichever ingestion reads it.

Schedule dates are not part of the OpenLineage spec. Airflow sends them in its own run
facets: the DAG's start_date on every DAG and task event, and a task's start_date and
end_date only when [openlineage] include_full_task_info is enabled.
"""

from dataclasses import dataclass
from typing import Any, TypeVar
from uuid import UUID

from dateutil.parser import isoparse
from pydantic import BaseModel

from metadata.generated.schema.entity.data.pipeline import (
    ExecutionError,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.type.basic import DateTime, Timestamp
from metadata.ingestion.source.pipeline.openlineage.models import (
    EventType,
    OpenLineageEvent,
)
from metadata.utils.time_utils import datetime_to_timestamp

STATUS_MAP = {
    EventType.START.value: StatusType.Pending,
    EventType.RUNNING.value: StatusType.Pending,
    EventType.COMPLETE.value: StatusType.Successful,
    EventType.FAIL.value: StatusType.Failed,
    EventType.ABORT.value: StatusType.Failed,
}

# A run or a job never goes back to an earlier state: Spark sends COMPLETE after a
# SQL job's FAIL, and events of one run can be read in any order across ingestions.
_PROGRESS = {StatusType.Pending: 0, StatusType.Successful: 1, StatusType.Failed: 2}

# Facets carrying the error of a failed run: the standard one, and the one Spark sends.
_ERROR_FACETS = ("errorMessage", "spark.exception")


@dataclass(frozen=True)
class RunUpdate:
    """What one event tells about the pipeline run it belongs to."""

    run_id: str
    run_key: int
    pipeline_job: str
    job: str
    is_pipeline_run: bool
    parent_is_pipeline_run: bool
    status: StatusType
    started_at: int | None
    ended_at: int | None
    error: ExecutionError | None


def pipeline_job(event: OpenLineageEvent) -> dict:
    """The job a pipeline is named after: the parent job when the event has one."""
    try:
        parent_job = event.run_facet["facets"]["parent"]["job"]
        return {"namespace": parent_job["namespace"], "name": parent_job["name"]}
    except (KeyError, TypeError):
        return event.job


def _airflow_facet(event: OpenLineageEvent) -> dict:
    facets = event.run_facet.get("facets") or {}
    # "airflow" rides on task events, "airflowDagRun" on DAG run events.
    for name in ("airflow", "airflowDagRun"):
        facet = facets.get(name)
        if isinstance(facet, dict):
            return facet
    return {}


def pipeline_start_date(event: OpenLineageEvent) -> DateTime | None:
    """The DAG's start_date, for the pipeline named after that DAG only: a DAG run with a parent
    facet (triggered from another DAG's task) is named after its parent."""
    dag = _airflow_facet(event).get("dag")
    if not isinstance(dag, dict) or dag.get("dag_id") != pipeline_job(event)["name"]:
        return None
    start_date = dag.get("start_date")
    return DateTime(isoparse(start_date)) if start_date else None


def pipeline_tasks(event: OpenLineageEvent) -> list[Task]:
    """The tasks an event shows on its pipeline: the pipeline's own job and the event's job."""
    run_name = pipeline_job(event)["name"]
    job_name = event.job["name"]
    tasks = {run_name: Task(name=run_name, displayName=run_name)}
    if job_name != run_name:
        task_facet = _airflow_facet(event).get("task")
        dates = task_facet if isinstance(task_facet, dict) else {}
        tasks[job_name] = Task(
            name=job_name,
            displayName=job_name.removeprefix(f"{run_name}."),
            startDate=dates.get("start_date"),
            endDate=dates.get("end_date"),
        )
    return list(tasks.values())


def _uuid7_millis(run_id: str) -> int | None:
    try:
        run_uuid = UUID(run_id)
    except ValueError:
        return None
    return run_uuid.int >> 80 if run_uuid.version == 7 else None


def _millis(event_time: str | None) -> int | None:
    return datetime_to_timestamp(isoparse(event_time), milliseconds=True) if event_time else None


def _error(facets: dict, job: str) -> ExecutionError | None:
    for name in _ERROR_FACETS:
        facet = facets.get(name)
        if isinstance(facet, dict):
            return ExecutionError(errorMessage=facet.get("message"), stackTrace=facet.get("stackTrace"), failedTask=job)
    return None


def build_run_update(event: OpenLineageEvent) -> RunUpdate | None:
    status = STATUS_MAP.get(event.event_type)
    if status is None:
        return None
    facets = event.run_facet.get("facets") or {}
    job = event.job["name"]
    is_pipeline_run = "parent" not in facets
    ended_at = _millis(event.event_time) if status != StatusType.Pending else None
    if is_pipeline_run:
        run_job, run_id, parent_is_pipeline_run = job, event.run_facet["runId"], False
    else:
        try:
            parent = facets["parent"]
            run_job, run_id = parent["job"]["name"], parent["run"]["runId"]
        except (KeyError, TypeError):
            return None
        root = parent.get("root")
        parent_is_pipeline_run = isinstance(root, dict) and (root.get("run") or {}).get("runId") == run_id
    run_key = _uuid7_millis(run_id)
    if run_key is None:
        # Without a time in the runId, only the run's own final event gives it a stable key.
        if not is_pipeline_run or ended_at is None:
            return None
        run_key = ended_at
    return RunUpdate(
        run_id=run_id,
        run_key=run_key,
        pipeline_job=run_job,
        job=job,
        is_pipeline_run=is_pipeline_run,
        parent_is_pipeline_run=parent_is_pipeline_run,
        status=status,
        started_at=_millis(event.event_time) if event.event_type == EventType.START.value else None,
        ended_at=ended_at,
        error=_error(facets, job) if status == StatusType.Failed else None,
    )


def _later(current: StatusType, incoming: StatusType) -> StatusType:
    return incoming if _PROGRESS[incoming] >= _PROGRESS[current] else current


def _value(timestamp: Timestamp | None) -> int | None:
    return timestamp.root if timestamp is not None else None


def _latest(*times: int | None) -> int | None:
    return max((time for time in times if time is not None), default=None)


ModelT = TypeVar("ModelT", bound=BaseModel)


def _with(stored: ModelT | None, model: type[ModelT], **fields: Any) -> ModelT:
    """``model`` built on the stored one, so fields this connector does not set survive the write."""
    return model.model_validate({**(stored.model_dump() if stored else {}), **fields})


def _line(
    stored: TaskStatus | None, name: str, status: StatusType, started: int | None, ended: int | None
) -> TaskStatus:
    return _with(
        stored,
        TaskStatus,
        name=name,
        executionStatus=status,
        startTime=_value(stored.startTime) if stored and stored.startTime else started,
        endTime=_latest(_value(stored.endTime) if stored else None, ended),
    )


def merge_run_status(stored: PipelineStatus | None, update: RunUpdate) -> PipelineStatus | None:
    """
    The run's row once this event is applied, or None when nothing is to be written:
    a job event of a run the pipeline has no row for, a row of another run with the
    same key, or an event that changes nothing. A job failure still opens the row when
    its parent is the pipeline run, so a run whose start was never read cannot later
    complete as Successful.
    """
    opens_row = update.is_pipeline_run or (update.parent_is_pipeline_run and update.status == StatusType.Failed)
    if stored is None and not opens_row:
        return None
    if stored is not None and stored.executionId != update.run_id:
        return None

    stored_lines = {line.name: line for line in (stored.taskStatus if stored else None) or []}
    run_line = stored_lines.pop(update.pipeline_job, None)
    previous = stored.executionStatus if stored else update.status
    if update.is_pipeline_run or update.status == StatusType.Failed:
        status = _later(previous, update.status)
    else:
        status = previous
    if not update.is_pipeline_run:
        job_line = stored_lines.get(update.job)
        job_status = _later(job_line.executionStatus if job_line else update.status, update.status)
        stored_lines[update.job] = _line(job_line, update.job, job_status, update.started_at, update.ended_at)

    ended_at = None
    if status != StatusType.Pending:
        ended_at = _latest(_value(stored.endTime) if stored else None, update.ended_at)
    run_started = update.started_at if update.is_pipeline_run else None
    merged = _with(
        stored,
        PipelineStatus,
        timestamp=update.run_key,
        executionId=update.run_id,
        executionStatus=status,
        endTime=ended_at,
        error=stored.error if stored and stored.error else update.error,
        taskStatus=[
            _line(run_line, update.pipeline_job, status, run_started, ended_at),
            *stored_lines.values(),
        ],
    )
    return None if merged == stored else merged
