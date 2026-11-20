# The ingestion image restarts a crashed Airflow scheduler, and the local stack bounds its wait for Airflow

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** ingestion
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#38091

## Context
The Airflow scheduler is the foreground process of the ingestion container
(`ingestion/ingestion_dependency.sh`), with the api-server and dag-processor in the background. At
startup it can lose its MySQL connection (`(2013, 'Lost connection to server during query')` in
`Job.prepare_for_execution`); it exits, the container stops, and the api-server goes with it.
`docker/run_local_docker_common.sh` then polled the Airflow API with no limit, so the CLI E2E job
sat until its 60-minute step timeout. Two consecutive nightlies lost a connector this way.

## Decision
- `ingestion_dependency.sh` restarts a scheduler that exits non-zero, 5 seconds apart, up to
  `SCHEDULER_MAX_ATTEMPTS` attempts in total (default 5). After the last one the script exits with
  the scheduler's status, so the container still stops on a persistent failure. A zero exit ends
  the loop. A `SCHEDULER_MAX_ATTEMPTS` that is not a positive integer stops the script before
  Airflow starts, rather than leaving the restarts unbounded.
- `run_local_docker_common.sh` waits at most `AIRFLOW_READY_TIMEOUT_SECONDS` (default 600) in total
  for the Airflow API and the `sample_data` DAG, fails at once when `openmetadata_ingestion` is not
  running, and prints that container's last 200 log lines either way. Each request in those loops
  is capped at 10 seconds, so a stalled request cannot outlast the deadline.

## Consequences
- A transient scheduler crash costs about 5 seconds instead of the container. Healthy startups are
  unchanged: the API is ready in about 30 seconds on CI, well inside 600.
- A failed CI startup exits non-zero within minutes, which lets the startup step's own retry run.
- Deployments using the image or the quickstart compose files get the restarts too. A scheduler
  that keeps crashing still stops the container after 5 attempts (about 25 seconds of back-off).
- Revisit the budget if 5 attempts stops absorbing the crash, or if the scheduler's startup gains
  a retry of its own.
