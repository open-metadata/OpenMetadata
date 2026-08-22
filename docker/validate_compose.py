"""Wait for the sample_data DAG triggered by run_local_docker_common.sh to finish.

This runs inside the openmetadata_ingestion container via `docker exec`, which does
NOT inherit the host shell's exports. Every knob therefore has to be handed over as
an explicit `-e` flag by the caller; see the `docker exec` invocation in
run_local_docker_common.sh.

Output uses plain `print(flush=True)` rather than metadata.utils.logger: that module's
`basicConfig` never sets a level, so the root logger stays at WARNING and every INFO
progress line is silently dropped — the reason CI failures here used to arrive with no
diagnostics at all.

Every HTTP call is bounded by the time actually left, and the post-deadline diagnostic
pass gets its own small budget. A flat per-request timeout larger than the caller's
margin would let one stalled Airflow call carry the process past the outer `timeout`,
which killed the very diagnostics this script exists to print.

The wait is governed by VALIDATION_TIMEOUT_SECONDS on the host, forwarded here as
VALIDATE_COMPOSE_TIMEOUT_SECONDS. VALIDATE_COMPOSE_MAX_RETRIES remains an explicit
escape hatch that overrides that deadline; nothing in-tree sets it.
"""

import os
import sys
import time

import requests

AIRFLOW_URL = "http://localhost:8080"
USERNAME = "admin"
PASSWORD = "admin"

DAG_ID = "sample_data"
TASK_ID = "ingest_using_recipe"

# Upper bound for a single poll request. Well under any caller margin, so a stalled
# Airflow cannot outlive the deadline.
POLL_REQUEST_TIMEOUT = 30
# Floor, so a request issued moments before the deadline still gets a fair chance
# rather than failing on a sub-second timeout.
MIN_REQUEST_TIMEOUT = 5
# The diagnostic pass runs *after* the deadline, inside the caller's margin, so it is
# capped hard: total wall clock and per request.
DIAGNOSTIC_BUDGET_SECONDS = 20
DIAGNOSTIC_REQUEST_TIMEOUT = 8

_access_token: str | None = None
_last_dag_logs_supported: bool | None = None
_deadline: float | None = None


def log(message: str) -> None:
    print(message, flush=True)


def get_env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        return int(value)
    except ValueError:
        log(f"Invalid integer for {name}: {value}. Falling back to {default}.")
        return default


def resolve_timeout_seconds(poll_interval_seconds: int) -> int:
    """
    Wall-clock budget for the whole wait.

    VALIDATE_COMPOSE_MAX_RETRIES, if set, overrides the forwarded deadline and is
    expressed as a retry count; it is kept as an escape hatch for operators.
    """
    if os.getenv("VALIDATE_COMPOSE_MAX_RETRIES") is not None:
        return get_env_int("VALIDATE_COMPOSE_MAX_RETRIES", 60) * poll_interval_seconds

    return get_env_int("VALIDATE_COMPOSE_TIMEOUT_SECONDS", 600)


def remaining_seconds() -> float:
    """Time left before the wait deadline; infinite until main() sets one."""
    if _deadline is None:
        return float("inf")

    return _deadline - time.monotonic()


def poll_request_timeout() -> float:
    """Bound a poll request by whatever budget is actually left."""
    return max(MIN_REQUEST_TIMEOUT, min(POLL_REQUEST_TIMEOUT, remaining_seconds()))


def get_access_token(timeout: float) -> str | None:
    """Get OAuth access token for the Airflow 3.x API."""
    global _access_token

    if _access_token:
        return _access_token

    try:
        response = requests.post(
            f"{AIRFLOW_URL}/auth/token",
            headers={"Content-Type": "application/json"},
            json={"username": USERNAME, "password": PASSWORD},
            timeout=timeout,
        )
    except requests.exceptions.RequestException as exc:
        log(f"Could not reach the Airflow token endpoint: {exc}")
        return None

    if response.status_code == 201:
        _access_token = response.json().get("access_token")
        return _access_token

    log(f"Failed to get access token: {response.status_code} - {response.text}")
    return None


def airflow_get(path: str, timeout: float) -> requests.Response | None:
    """
    GET an Airflow API path, refreshing the cached token on 401.

    Returns None on any transport/auth problem so callers can keep polling: the
    Airflow API is routinely unreachable for the first ~40s after the container
    starts, and a blip mid-poll must not abort the wait.
    """
    global _access_token

    token = get_access_token(timeout)
    if not token:
        return None

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    try:
        response = requests.get(f"{AIRFLOW_URL}{path}", headers=headers, timeout=timeout)
    except requests.exceptions.RequestException as exc:
        log(f"Error calling {path}: {exc}")
        return None

    if response.status_code == 401:
        _access_token = None
        log(f"Airflow token rejected on {path}; will re-authenticate.")
        return None

    return response


def get_last_run_info() -> tuple[str | None, str | None, bool]:
    """
    Latest sample_data DAG run id and state.

    The third element reports whether the poll itself succeeded, so the caller can
    tell "Airflow has no run yet" apart from "we could not reach Airflow" — during the
    ~40s startup window those are very different things.
    """
    response = airflow_get(f"/api/v2/dags/{DAG_ID}/dagRuns", poll_request_timeout())
    if response is None:
        return None, None, False

    if response.status_code != 200:
        log(f"Error getting DAG runs: {response.status_code} - {response.text}")
        return None, None, False

    dag_runs = response.json().get("dag_runs") or []
    if not dag_runs:
        return None, None, True

    dag_run = sorted(dag_runs, key=lambda run: run.get("logical_date") or "", reverse=True)[0]

    return dag_run.get("dag_run_id"), (dag_run.get("state") or "").lower(), True


def print_last_run_logs(timeout: float) -> None:
    """Show the task logs, when the OpenMetadata Airflow plugin route is available."""
    global _last_dag_logs_supported

    if _last_dag_logs_supported is False:
        return

    response = airflow_get(f"/api/v2/openmetadata/last_dag_logs?dag_id={DAG_ID}&task_id={TASK_ID}", timeout)
    if response is None:
        return

    if response.status_code == 404:
        log("Airflow last_dag_logs route is unavailable. Skipping task log fetch.")
        _last_dag_logs_supported = False
        return

    if response.status_code != 200:
        log(f"Could not fetch logs: {response.status_code} - {response.text}")
        return

    _last_dag_logs_supported = True
    log(response.text)


def print_task_instance_states(dag_run_id: str, timeout: float) -> None:
    """
    Report per-task state for the run.

    This is what tells "the DAG needed a few more seconds" apart from "a task is
    stuck or dead" when the deadline is hit — without it the failure is
    indistinguishable from a hang.
    """
    response = airflow_get(f"/api/v2/dags/{DAG_ID}/dagRuns/{dag_run_id}/taskInstances", timeout)
    if response is None or response.status_code != 200:
        return

    log(f"Task instances for {dag_run_id}:")
    for task in response.json().get("task_instances") or []:
        log(
            f"  - {task.get('task_id')}: state={task.get('state')} "
            f"try={task.get('try_number')} start={task.get('start_date')} "
            f"end={task.get('end_date')} duration={task.get('duration')}"
        )


def dump_diagnostics(dag_run_id: str | None) -> None:
    """
    Best-effort failure detail, on a hard budget.

    Runs after the deadline has already passed, so it lives entirely inside the
    caller's margin below the outer `timeout`. Each step is skipped rather than
    allowed to overrun — partial diagnostics beat being SIGTERMed with none.
    """
    budget_end = time.monotonic() + DIAGNOSTIC_BUDGET_SECONDS

    def step_timeout() -> float | None:
        left = budget_end - time.monotonic()
        if left <= 1:
            return None
        return min(DIAGNOSTIC_REQUEST_TIMEOUT, left)

    if dag_run_id:
        timeout = step_timeout()
        if timeout is None:
            log("Diagnostic budget exhausted; skipping task-instance states.")
        else:
            print_task_instance_states(dag_run_id, timeout)

    timeout = step_timeout()
    if timeout is None:
        log("Diagnostic budget exhausted; skipping task log fetch.")
        return
    print_last_run_logs(timeout)


def main() -> None:
    global _deadline

    poll_interval_seconds = get_env_int("VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS", 10)
    timeout_seconds = resolve_timeout_seconds(poll_interval_seconds)
    _deadline = time.monotonic() + timeout_seconds

    log(f"Waiting up to {timeout_seconds}s for the {DAG_ID} DAG (polling every {poll_interval_seconds}s).")

    dag_run_id: str | None = None
    state: str | None = None

    while True:
        dag_run_id, state, polled = get_last_run_info()

        if dag_run_id and state == "success":
            log(f"DAG run: [{dag_run_id}, {state}]")
            print_last_run_logs(poll_request_timeout())
            log("Sample data ingestion completed successfully!")
            return

        if dag_run_id and state == "failed":
            log(f"DAG run [{dag_run_id}] FAILED!")
            dump_diagnostics(dag_run_id)
            raise SystemExit(f"Sample data ingestion failed. DAG run state: {state}")

        if dag_run_id:
            log(f"DAG run [{dag_run_id}] is {state}. Waiting for completion...")
        elif polled:
            log("Airflow has no DAG run yet. Waiting for it to start...")
        else:
            log("Could not reach the Airflow API. Retrying...")

        remaining = remaining_seconds()
        if remaining <= 0:
            break

        time.sleep(min(poll_interval_seconds, remaining))

    log(f"Timed out after {timeout_seconds}s waiting for the {DAG_ID} DAG.")
    dump_diagnostics(dag_run_id)
    raise SystemExit(
        f"Sample data ingestion did not finish within {timeout_seconds}s "
        f"(last observed run={dag_run_id}, state={state}). Raise "
        "VALIDATION_TIMEOUT_SECONDS if the run above was still making progress."
    )


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        if exc.code:
            log(f"ERROR: {exc.code}")
        sys.exit(1 if exc.code else 0)
