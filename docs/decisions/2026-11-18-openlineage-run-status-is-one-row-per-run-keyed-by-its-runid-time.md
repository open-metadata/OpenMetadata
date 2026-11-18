# OpenLineage run status is one row per run, keyed by the time in its runId

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Akash Verma
- **Guard:** `test_openlineage_status.py` — `test_successful_run_is_one_row_with_a_line_per_job`, `test_failed_sql_job_fails_the_run_although_the_application_completes`, `test_each_try_of_a_retried_airflow_task_is_its_own_line`, `PipelineDetailsUtils.test.tsx`, `test_tries_read_out_of_order_each_find_their_own_line`, `test_tasks_read_before_the_dag_run_start_are_kept`, `test_run_whose_id_carries_the_millisecond_of_another_run_takes_the_next_free_key`, `test_dag_run_error_names_the_task_that_failed_it_not_a_try_a_retry_made_good`, `test_start_read_in_a_later_ingestion_than_complete_never_downgrades`
- **Related:** #19481, #19321, #37990, ADR:2026-11-18-openlineage-runs-are-their-own-pipelines-and-steps-join-their-parent

## Context
An OpenLineage run sends several events (START, RUNNING, COMPLETE, FAIL, ABORT) for itself and for
each of its steps, and the pull connector may read them in any order and across ingestions. The
server keeps one `PipelineStatus` per pipeline and timestamp, and each write replaces the row. Every
event therefore has to find the same row without any state kept between ingestions.

## Decision
- A run's row has the millisecond embedded in its UUIDv7 `runId` (OpenLineage 1.15 and later) as
  its timestamp, and the `runId` as its `executionId`. Events find their row by `executionId`
  among the pipeline's rows of the next 1000 ms; a run whose millisecond another run holds takes
  the first free one. A `runId` that is not UUIDv7 carries no time, so only the run's own final
  event writes a row, keyed by its `eventTime`.
- START and RUNNING are Pending, COMPLETE is Successful, FAIL and ABORT are Failed: `StatusType`
  has no aborted value. A run or a step try never goes back in the order Pending, Successful,
  Failed, so an event read late cannot undo a later one.
- The run's own events set the row's status. A failed step fails the run too, except an Airflow
  task (`jobType` TASK): a retry or a trigger rule can still let the DAG run succeed, and the DAG
  run sends its own FAIL. A Spark application always ends with COMPLETE, so this is how its failed
  SQL job fails it. Any event opens the row; the run stays Pending until its own final event.
- Each try of a step is its own task line, holding the try's `runId` as `taskId`. A task's status
  in the Tasks view is that of its latest try (`getTaskExecStatus`). The run itself is not a task.
  A step's task is added to the pipeline and never removed.
- The row's error is the first failure that still stands: a step's error is dropped when a later
  try of that step succeeds before the run has failed, and any error is dropped when the run ends
  Successful.
- FAIL and ABORT events write status only, never lineage: their datasets are what the job meant to
  read and write.

## Consequences
Rows are stable whichever ingestion reads an event and in whatever order, at the cost of one
status read per event. More than 1000 runs of one pipeline starting in the same second, or senders
older than OpenLineage 1.15, lose rows or step lines. A task that fails on every try reports the
first try's error. Revisit if the server gains a run-start time or an aborted status, or if status
moves to the `/api/v1/openlineage` endpoint.
