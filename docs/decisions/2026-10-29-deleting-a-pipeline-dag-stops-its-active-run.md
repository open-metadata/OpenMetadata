# Deleting a pipeline's Airflow DAG stops its active run instead of failing

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `test_delete_stops_a_running_dag_and_removes_it`, `test_other_airflow_errors_do_not_stop_active_runs` in `openmetadata-airflow-apis/tests/integration/operations/test_dag_lifecycle.py`
- **Related:** #36350, #36349, #36267

## Context

Airflow's `delete_dag` refuses while any task instance of the DAG is running. The server commits
the hard delete of an ingestion pipeline (`cleanup()`) before `postDelete` asks the runner to
remove the DAG, so a refusal cannot keep the pipeline: returning 409 from the plugin left the
pipeline deleted and the DAG in Airflow, still scheduled, with nothing in OpenMetadata to manage it.

## Decision

When `delete_dag` raises because a task instance is running, the plugin's delete operation fails
the DAG's unfinished runs and task instances (as `kill` does) and deletes again in the same
session. Any other Airflow error still propagates and leaves the runs and files untouched.

## Consequences

- Every delete path (direct, by name, async, force, service recursive cascade, app uninstall)
  removes the DAG, because all of them reach this one plugin endpoint.
- Deleting a pipeline mid-run ends that run as failed; the running task is terminated by Airflow.
- Revisit only if the server moves the runner teardown ahead of its DB commit; then refusing the
  delete would become a viable alternative.
