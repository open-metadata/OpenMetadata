# OpenLineage run status is one row per run, keyed by the time in its runId

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Akash Verma
- **Guard:** `test_openlineage_status.py` — `test_successful_run_is_one_row_with_a_line_per_job`, `test_failed_sql_job_fails_the_run_although_the_application_completes`, `test_each_try_of_a_retried_airflow_task_is_its_own_line`, `PipelineDetailsUtils.test.tsx`, `test_tries_read_out_of_order_each_find_their_own_line`, `test_tasks_read_before_the_dag_run_start_are_kept`, `test_run_whose_id_carries_the_millisecond_of_another_run_takes_the_next_free_key`, `test_dag_run_error_names_the_task_that_failed_it_not_a_try_a_retry_made_good`, `test_retry_of_the_blamed_task_moves_the_blame_to_a_task_still_failing`, `test_failed_try_read_after_its_retry_succeeded_does_not_become_the_error`, `test_start_read_in_a_later_ingestion_than_complete_never_downgrades`, `test_every_status_line_names_a_task_of_the_pipeline`, `test_step_name_without_its_parent_job_prefix_names_its_task_whole`, `test_dag_run_failure_read_before_its_task_failure_still_names_the_task`, `test_dag_run_failure_read_before_the_retry_that_made_its_task_good_blames_no_task`, `test_step_that_failed_first_is_blamed_whatever_the_read_order`, `test_task_failing_while_another_is_retried_is_blamed_only_when_the_retry_passes`, `test_task_failing_while_another_is_retried_keeps_its_message_when_the_retry_passes`
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
  the first free one. A `runId` that is not UUIDv7 carries no time, so the run's steps, failures
  included, cannot join its row: the run gets no status, and its own final event logs a warning.
  A row from the final event alone would show a Spark application whose step failed as Successful.
- START and RUNNING are Pending, COMPLETE is Successful, FAIL is Failed, and ABORT is Skipped:
  producers send ABORT for a job stopped without failing (a skipped, canceled or killed dbt node
  or command, a canceled Flink job), as the dbt Cloud connector maps a canceled run. A run or a
  step try never goes back in the order Pending, Skipped, Successful, Failed, so an event read
  late cannot undo a later one.
- The run's own events set the row's status. A failed step fails the run too, except an Airflow
  task (`jobType` TASK): a retry or a trigger rule can still let the DAG run succeed, and the DAG
  run sends its own FAIL. A Spark application always ends with COMPLETE, so this is how its failed
  SQL job fails it. Any event opens the row; the run stays Pending until its own final event.
- Each try of a step is its own task line, holding the try's `runId` as `taskId`. A task's status
  in the Tasks view is that of its latest try (`getTaskExecStatus`). The run itself is not a task.
  A step's task is added to the pipeline and never removed.
- A step's task, its status lines and `error.failedTask` carry one name: the job name without the
  `<pipeline job>.` prefix (`load` for the job `nightly_retry.load`), and `displayName` is the same.
  A name without that prefix, such as a dbt model named after its table, is kept whole. This
  replaces the full job name as the task name with the short one as its display name: the native
  Airflow connector names a task by its `task_id`, so the same task reads the same in both, and the
  Tasks view and run lines show the step without repeating its pipeline.
- The row's error is the earliest failure that still stands, whatever order its events are read in;
  a step failed when its first failed try ended, and a failed try keeps that time when Spark sends
  its COMPLETE after the FAIL. An Airflow task's failure stops standing once a later try of the task
  is known and did not fail. A Spark SQL job named like a failed one is another job, so the failed
  one still stands. A step failure takes the error's place when the error is the run's own, names a
  failure that no longer stands, or names a step that failed later. When a later try of the blamed
  task succeeds, the error names the task still failing that failed earliest, without its message:
  the row holds one error, so that task's message was not kept. With no such task the error is
  dropped. Any error is dropped when the run ends Successful.
- FAIL and ABORT events write status only, never lineage: their datasets are what the job meant to
  read and write.

## Consequences
Rows are stable whichever ingestion reads an event and in whatever order, at the cost of one status
read per event. More than 1000 runs of one pipeline starting in the same second lose rows, and runs
of senders older than OpenLineage 1.15 (Spark, Airflow before mid-2024) get no status. A task that fails on every try reports the first
try's error, or a later try's when another task failed while it was retried or the first try is read
after a later one started. A run whose first failed step is later retried successfully names the
step that still fails but not its message, and a DAG run whose own failure was read before that
retry keeps no error at all. Revisit if `TaskStatus` gains an error, the server gains a run-start
time or an aborted status, or status moves to the `/api/v1/openlineage` endpoint.
