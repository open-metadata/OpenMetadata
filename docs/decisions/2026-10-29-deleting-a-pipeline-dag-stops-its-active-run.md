# Deleting a pipeline's Airflow DAG stops its active run instead of failing

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `test_delete_stops_a_running_dag_and_removes_it`, `test_failed_delete_leaves_active_runs_untouched` in `openmetadata-airflow-apis/tests/integration/operations/test_dag_lifecycle.py`
- **Related:** #36350, #36349, #36267

## Context

Airflow's `delete_dag` refuses while any task instance of the DAG is running. The server commits
the hard delete of an ingestion pipeline (`cleanup()`) before `postDelete` asks the runner to
remove the DAG, so a refusal cannot keep the pipeline: returning 409 from the plugin left the
pipeline deleted and the DAG in Airflow, still scheduled, with nothing in OpenMetadata to manage it.

## Decision

When `delete_dag` raises because a task instance is running, the plugin's delete operation fails
the DAG's unfinished runs and task instances (as `kill` does) and deletes again, in one
transaction: if the retried delete also fails, nothing is committed, so the runs stay as they were
and the DAG files stay on disk. Any other Airflow error propagates the same way.

## Consequences

- Every delete path (direct, by name, async, force, service recursive cascade, app uninstall)
  removes the DAG, because all of them reach this one plugin endpoint.
- Deleting a pipeline mid-run ends that run as failed; the running task is terminated by Airflow.
- A task that starts running between the stop and the retry makes the retry fail; the delete then
  fails as it did before this record, with the run left untouched.
- Revisit only if the server moves the runner teardown ahead of its DB commit; then refusing the
  delete would become a viable alternative.
