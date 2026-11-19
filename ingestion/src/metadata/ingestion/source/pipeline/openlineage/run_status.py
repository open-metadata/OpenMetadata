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

A pipeline run is an event without a parent facet, or one whose job type names a run of
its own: a Spark application, an Airflow DAG run or a dbt run, even when another system
started it (ADR:2026-11-18-openlineage-runs-are-their-own-pipelines-and-steps-join-their-parent).
Any other event with a parent is a step of the parent's run: a Spark SQL job, an Airflow
task, a dbt model. The run's own events and its steps' events are merged into one status
row. The run's own events set the row, and each try of a step gets its own task line,
holding the try's runId as taskId: the run is not a task of its pipeline. The row is keyed
by the time embedded in the run's UUIDv7 runId, so every event of the run finds the same
row whichever ingestion reads it
(ADR:2026-11-18-openlineage-run-status-is-one-row-per-run-keyed-by-its-runid-time).

Schedule dates are not part of the OpenLineage spec. Airflow sends them in its own run
facets: the DAG's start_date on every DAG and task event, and a task's start_date and
end_date only when [openlineage] include_full_task_info is enabled.
"""

from dataclasses import dataclass, replace
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

# A run or a try of a step never goes back to an earlier state: Spark sends COMPLETE after
# a SQL job's FAIL, and events of one run can be read in any order across ingestions.
_PROGRESS = {StatusType.Pending: 0, StatusType.Successful: 1, StatusType.Failed: 2}

# The server keeps one status per pipeline and timestamp, so two runs whose ids carry the same
# millisecond cannot share a key: the run read second takes the next free one within this window.
RUN_KEY_WINDOW_MS = 1000

# Facets carrying the error of a failed run: the standard one, and the one Spark sends.
_ERROR_FACETS = ("errorMessage", "spark.exception")

# jobType facet values of a whole run, set by the Spark, Airflow and dbt integrations; their
# steps are SQL_JOB, TASK, and MODEL, SNAPSHOT or TEST.
_RUN_JOB_TYPES = {"APPLICATION", "DAG", "JOB"}

# A failed Airflow task does not fail its DAG run: a retry or a trigger rule can still let the
# DAG succeed, and the DAG run sends its own FAIL. A Spark application always ends with
# COMPLETE, so a failed SQL job fails it.
_STEPS_THAT_LEAVE_THE_RUN_OUTCOME_TO_IT = {"TASK"}


@dataclass(frozen=True)
class RunUpdate:
    """What one event tells about the pipeline run it belongs to."""

    run_id: str
    run_key: int
    job: str
    job_run_id: str
    is_pipeline_run: bool
    fails_run: bool
    status: StatusType
    started_at: int | None
    ended_at: int | None
    error: ExecutionError | None


def _job_type(event: OpenLineageEvent) -> str | None:
    return ((event.job.get("facets") or {}).get("jobType") or {}).get("jobType")


def _is_own_run(event: OpenLineageEvent) -> bool:
    return _job_type(event) in _RUN_JOB_TYPES


def launched_by(event: OpenLineageEvent) -> tuple[dict, dict] | None:
    """The job that started this run from another system (an Airflow task starting a Spark
    application), and that job's root (the DAG), when the event is such a run and names both."""
    facets = event.run_facet.get("facets") or {}
    if "parent" not in facets or not _is_own_run(event):
        return None
    try:
        parent, root = facets["parent"]["job"], facets["parent"]["root"]["job"]
        return (
            {"namespace": parent["namespace"], "name": parent["name"]},
            {"namespace": root["namespace"], "name": root["name"]},
        )
    except (KeyError, TypeError):
        return None


def pipeline_job(event: OpenLineageEvent) -> dict:
    """The job a pipeline is named after: the parent job when the event is a step of the parent's run."""
    if _is_own_run(event):
        return event.job
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
    """The DAG's start_date, for the pipeline named after that DAG only."""
    dag = _airflow_facet(event).get("dag")
    if not isinstance(dag, dict) or dag.get("dag_id") != pipeline_job(event)["name"]:
        return None
    start_date = dag.get("start_date")
    return DateTime(isoparse(start_date)) if start_date else None


def pipeline_tasks(event: OpenLineageEvent) -> list[Task]:
    """The task an event adds to its pipeline: its job, unless the event is of the pipeline run itself."""
    run_name = pipeline_job(event)["name"]
    job_name = event.job["name"]
    if job_name == run_name:
        return []
    task_facet = _airflow_facet(event).get("task")
    dates = task_facet if isinstance(task_facet, dict) else {}
    return [
        Task(
            name=job_name,
            displayName=job_name.removeprefix(f"{run_name}."),
            startDate=dates.get("start_date"),
            endDate=dates.get("end_date"),
        )
    ]


def _uuid7_millis(run_id: str) -> int | None:
    try:
        run_uuid = UUID(run_id)
    except ValueError:
        return None
    return run_uuid.int >> 80 if run_uuid.version == 7 else None


def _millis(event_time: str | None) -> int | None:
    return datetime_to_timestamp(isoparse(event_time), milliseconds=True) if event_time else None


def _error(facets: dict, job: str | None) -> ExecutionError | None:
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
    is_pipeline_run = "parent" not in facets or _is_own_run(event)
    if is_pipeline_run:
        run_id = event.run_facet["runId"]
    else:
        try:
            parent = facets["parent"]
            # The parent job must be there too: the pipeline is named after it.
            _, run_id = parent["job"]["name"], parent["run"]["runId"]
        except (KeyError, TypeError):
            return None
    ended_at = _millis(event.event_time) if status != StatusType.Pending else None
    run_key = _uuid7_millis(run_id)
    if run_key is None:
        # Without a time in the runId, only the run's own final event gives it a stable key.
        if not is_pipeline_run or ended_at is None:
            return None
        run_key = ended_at
    return RunUpdate(
        run_id=run_id,
        run_key=run_key,
        job=job,
        job_run_id=event.run_facet["runId"],
        is_pipeline_run=is_pipeline_run,
        fails_run=status == StatusType.Failed and _job_type(event) not in _STEPS_THAT_LEAVE_THE_RUN_OUTCOME_TO_IT,
        status=status,
        started_at=_millis(event.event_time) if event.event_type == EventType.START.value else None,
        ended_at=ended_at,
        error=_error(facets, None if is_pipeline_run else job) if status == StatusType.Failed else None,
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


def _line(stored: TaskStatus | None, update: RunUpdate) -> TaskStatus:
    """The line of the step try the event belongs to."""
    return _with(
        stored,
        TaskStatus,
        name=update.job,
        taskId=update.job_run_id,
        executionStatus=_later(stored.executionStatus, update.status) if stored else update.status,
        startTime=_value(stored.startTime) if stored and stored.startTime else update.started_at,
        endTime=_latest(_value(stored.endTime) if stored else None, update.ended_at),
    )


def _try_time(line: TaskStatus) -> int:
    return _value(line.startTime) or _value(line.endTime) or 0


def _latest_tries(lines: list[TaskStatus]) -> dict[str, TaskStatus]:
    return {line.name: line for line in sorted(lines, key=_try_time)}


def _first_step_still_failing(lines: list[TaskStatus], other_than: str) -> str | None:
    """The step whose latest try failed earliest, other than ``other_than``."""
    failing = [
        line
        for name, line in _latest_tries(lines).items()
        if name != other_than and line.executionStatus == StatusType.Failed
    ]
    return min(failing, key=_try_time).name if failing else None


def place_run(rows: list[PipelineStatus], update: RunUpdate) -> tuple[PipelineStatus | None, RunUpdate] | None:
    """
    The run's stored row and the update keyed to it, given the pipeline's rows from the run's key
    to the end of RUN_KEY_WINDOW_MS: the row holding the run's id, or else no row and the first
    free key. None when every key of the window is taken.
    """
    for row in rows:
        if row.executionId == update.run_id:
            return row, replace(update, run_key=row.timestamp.root)
    taken = {row.timestamp.root for row in rows}
    free = next((key for key in range(update.run_key, update.run_key + RUN_KEY_WINDOW_MS) if key not in taken), None)
    return None if free is None else (None, replace(update, run_key=free))


def merge_run_status(stored: PipelineStatus | None, update: RunUpdate) -> PipelineStatus | None:
    """
    The run's row once this event is applied, or None when it changes nothing. Any event opens
    the row, so a step read before its run's own events (or without them) still shows; the run
    stays Pending until its own final event or a failure that fails it. ``stored`` is the run's
    own row, as place_run found it.
    """
    lines = list((stored.taskStatus if stored else None) or [])
    status = stored.executionStatus if stored else StatusType.Pending
    error = stored.error if stored else None
    if update.is_pipeline_run:
        status = _later(status, update.status)
    else:
        if update.fails_run:
            status = _later(status, StatusType.Failed)
        index = next((i for i, line in enumerate(lines) if line.taskId == update.job_run_id), None)
        line = _line(lines[index] if index is not None else None, update)
        if index is None:
            lines.append(line)
        else:
            lines[index] = line
        if not update.fails_run and _latest_tries(lines)[update.job].executionStatus != StatusType.Failed:
            # A failed try read after a later try of its step no longer explains the run.
            update = replace(update, error=None)
        if error is not None and error.failedTask == update.job and line.executionStatus == StatusType.Successful:
            # A later try of the failed step succeeded, so its failure no longer explains the run.
            # The row keeps one error, so a step still failing is named without its message. A
            # run already failed with no other step failing keeps the error: one Spark application
            # can run two SQL jobs of one name, and the failed one failed the run.
            still_failing = _first_step_still_failing(lines, other_than=update.job)
            if still_failing is not None:
                error = ExecutionError(failedTask=still_failing)
            elif status != StatusType.Failed:
                error = None

    ended_at = None
    if status != StatusType.Pending:
        ended_at = _latest(_value(stored.endTime) if stored else None, update.ended_at)
    merged = _with(
        stored,
        PipelineStatus,
        timestamp=update.run_key,
        executionId=update.run_id,
        executionStatus=status,
        endTime=ended_at,
        error=None if status == StatusType.Successful else (error or update.error),
        taskStatus=lines,
    )
    return None if merged == stored else merged
