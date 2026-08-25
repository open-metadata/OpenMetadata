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
VALIDATE_COMPOSE_TIMEOUT_SECONDS. VALIDATE_COMPOSE_MAX_RETRIES may shorten that
deadline, but it cannot extend past the outer timeout's diagnostic margin.
"""

import os
import sys
import time
from urllib.parse import quote, urlencode

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
TASK_INSTANCE_PAGE_SIZE = 100

_access_token: str | None = None
_http_session: requests.Session | None = None
_last_dag_logs_supported: bool | None = None
_deadline: float | None = None


def log(message: str) -> None:
    print(message, flush=True)


def get_http_session() -> requests.Session:
    """Return the HTTP session shared by this validator invocation."""
    global _http_session

    if _http_session is None:
        _http_session = requests.Session()
    return _http_session


def get_json_object(
    response: requests.Response, response_name: str
) -> dict[str, object] | None:
    """Parse an Airflow JSON object without turning a proxy error into a validator crash."""
    try:
        payload = response.json()
    except ValueError:
        log(f"Airflow returned invalid JSON for {response_name}.")
        return None

    if not isinstance(payload, dict):
        log(f"Airflow returned an invalid {response_name} response.")
        return None

    return payload


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

    An explicit retry count can shorten the wait, but cannot let it outlive the
    forwarded deadline. The host reserves the remaining outer-timeout budget for
    diagnostics, so extending this deadline would let `timeout` kill their output.
    """
    timeout_seconds = get_env_int("VALIDATE_COMPOSE_TIMEOUT_SECONDS", 600)
    if os.getenv("VALIDATE_COMPOSE_MAX_RETRIES") is not None:
        retry_timeout_seconds = get_env_int("VALIDATE_COMPOSE_MAX_RETRIES", 60) * poll_interval_seconds
        return min(timeout_seconds, retry_timeout_seconds)

    return timeout_seconds


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
        response = get_http_session().post(
            f"{AIRFLOW_URL}/auth/token",
            headers={"Content-Type": "application/json"},
            json={"username": USERNAME, "password": PASSWORD},
            timeout=timeout,
        )
    except requests.exceptions.RequestException as exc:
        log(f"Could not reach the Airflow token endpoint: {exc}")
        return None

    if response.status_code != 201:
        log(f"Failed to get access token: {response.status_code} - {response.text}")
        return None

    payload = get_json_object(response, "access-token")
    if payload is None:
        return None

    access_token = payload.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        log("Airflow access-token response did not contain an access token.")
        return None

    _access_token = access_token
    return _access_token


def airflow_get(path: str, timeout: float) -> requests.Response | None:
    """
    GET an Airflow API path, refreshing the cached token on 401.

    Returns None on any transport/auth problem so callers can keep polling: the
    Airflow API is routinely unreachable for the first ~40s after the container
    starts, and a blip mid-poll must not abort the wait.
    """
    global _access_token

    # Authentication shares this endpoint's budget; otherwise a token refresh can
    # double the duration of a poll issued close to the validation deadline.
    request_deadline = time.monotonic() + timeout
    for request_attempt in range(2):
        remaining = request_deadline - time.monotonic()
        if remaining <= 0:
            log(f"No time left to call {path} after authentication.")
            return None

        token = get_access_token(remaining)
        if not token:
            return None

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        remaining = request_deadline - time.monotonic()
        if remaining <= 0:
            log(f"No time left to call {path} after authentication.")
            return None

        try:
            response = get_http_session().get(
                f"{AIRFLOW_URL}{path}", headers=headers, timeout=remaining
            )
        except requests.exceptions.RequestException as exc:
            log(f"Error calling {path}: {exc}")
            return None

        if response.status_code != 401:
            return response

        _access_token = None
        if request_attempt == 0:
            log(f"Airflow token rejected on {path}; refreshing it once.")
        else:
            log(f"Airflow token rejected after refresh on {path}.")

    return None


def get_last_run_info(
    target_dag_run_id: str | None,
    target_logical_date: str | None,
    timeout: float,
) -> tuple[str | None, str | None, bool]:
    """
    Targeted sample_data DAG run id and state.

    The third element reports whether the poll itself succeeded, so the caller can
    tell "Airflow has no run yet" apart from "we could not reach Airflow" — during the
    ~40s startup window those are very different things.
    """
    if target_dag_run_id:
        path = f"/api/v2/dags/{DAG_ID}/dagRuns/{quote(target_dag_run_id, safe='')}"
    else:
        query_params: dict[str, str | int] = {"limit": 1, "order_by": "-logical_date"}
        if target_logical_date:
            query_params["logical_date_gte"] = target_logical_date
            query_params["logical_date_lte"] = target_logical_date
        path = f"/api/v2/dags/{DAG_ID}/dagRuns?{urlencode(query_params)}"

    response = airflow_get(path, timeout)
    if response is None:
        return None, None, False

    if response.status_code != 200:
        log(f"Error getting DAG runs: {response.status_code} - {response.text}")
        return None, None, False

    payload = get_json_object(response, "DAG-run" if target_dag_run_id else "DAG-runs")
    if payload is None:
        return None, None, False

    if target_dag_run_id:
        dag_run_id = payload.get("dag_run_id")
        if not isinstance(dag_run_id, str) or not dag_run_id:
            log("Airflow DAG-run response did not contain a dag_run_id.")
            return None, None, False

        state = payload.get("state")
        return dag_run_id, state.lower() if isinstance(state, str) else "", True

    dag_runs = payload.get("dag_runs")
    if not isinstance(dag_runs, list):
        log("Airflow DAG-runs response did not contain a list of dag_runs.")
        return None, None, False
    if not dag_runs:
        return None, None, True

    if not all(isinstance(run, dict) for run in dag_runs):
        log("Airflow DAG-runs response contained an invalid DAG run.")
        return None, None, False

    dag_run = max(
        dag_runs,
        key=lambda run: run.get("logical_date")
        if isinstance(run.get("logical_date"), str)
        else "",
    )
    dag_run_id = dag_run.get("dag_run_id")
    if not isinstance(dag_run_id, str) or not dag_run_id:
        log("Airflow DAG-runs response did not contain a dag_run_id.")
        return None, None, False

    state = dag_run.get("state")
    return dag_run_id, state.lower() if isinstance(state, str) else "", True


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
    request_deadline = time.monotonic() + timeout
    offset = 0
    task_instances_path = (
        f"/api/v2/dags/{DAG_ID}/dagRuns/{quote(dag_run_id, safe='')}/taskInstances"
    )

    while True:
        remaining = request_deadline - time.monotonic()
        if remaining <= 0:
            log("Diagnostic request budget exhausted while fetching task-instance states.")
            return

        query_params = {"limit": TASK_INSTANCE_PAGE_SIZE, "offset": offset}
        path = f"{task_instances_path}?{urlencode(query_params)}"
        response = airflow_get(path, remaining)
        if response is None:
            return
        if response.status_code != 200:
            log(f"Could not fetch task instances: {response.status_code} - {response.text}")
            return

        payload = get_json_object(response, "task-instances")
        if payload is None:
            return

        task_instances = payload.get("task_instances")
        if not isinstance(task_instances, list):
            log("Airflow task-instances response did not contain a list of task_instances.")
            return

        if offset == 0:
            log(f"Task instances for {dag_run_id}:")
        for task in task_instances:
            if not isinstance(task, dict):
                log("Airflow task-instances response contained an invalid task instance.")
                continue
            log(
                f"  - {task.get('task_id')}: state={task.get('state')} "
                f"try={task.get('try_number')} start={task.get('start_date')} "
                f"end={task.get('end_date')} duration={task.get('duration')}"
            )

        offset += len(task_instances)
        total_entries = payload.get("total_entries")
        if total_entries is not None:
            if type(total_entries) is not int:
                log("Airflow task-instances response contained an invalid total_entries value.")
                return
            if offset >= total_entries:
                return
            if not task_instances:
                log("Airflow task-instances response ended before total_entries.")
                return
        elif len(task_instances) < TASK_INSTANCE_PAGE_SIZE:
            return


def dump_diagnostics(
    dag_run_id: str | None,
    dag_run_state: str | None,
) -> tuple[str | None, str | None]:
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

    diagnostic_dag_run_id = dag_run_id
    diagnostic_dag_run_state = dag_run_state

    if dag_run_id:
        timeout = step_timeout()
        if timeout is None:
            log("Diagnostic budget exhausted; skipping DAG-run state.")
        else:
            observed_dag_run_id, observed_state, _ = get_last_run_info(
                dag_run_id,
                None,
                timeout,
            )
            if observed_dag_run_id:
                diagnostic_dag_run_id = observed_dag_run_id
                diagnostic_dag_run_state = observed_state
                log(
                    f"Diagnostic DAG run [{observed_dag_run_id}] is "
                    f"{observed_state or 'unknown'}."
                )

        timeout = step_timeout()
        if timeout is None:
            log("Diagnostic budget exhausted; skipping task-instance states.")
        else:
            print_task_instance_states(dag_run_id, timeout)

    timeout = step_timeout()
    if timeout is None:
        log("Diagnostic budget exhausted; skipping task log fetch.")
    else:
        print_last_run_logs(timeout)

    return diagnostic_dag_run_id, diagnostic_dag_run_state


def main() -> None:
    global _deadline

    poll_interval_seconds = get_env_int("VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS", 10)
    timeout_seconds = resolve_timeout_seconds(poll_interval_seconds)
    _deadline = time.monotonic() + timeout_seconds
    target_dag_run_id = os.getenv("VALIDATE_COMPOSE_DAG_RUN_ID") or None
    target_logical_date = os.getenv("VALIDATE_COMPOSE_LOGICAL_DATE") or None

    if target_dag_run_id:
        target_description = f"DAG run {target_dag_run_id}"
    elif target_logical_date:
        target_description = f"DAG run at logical date {target_logical_date}"
    else:
        target_description = f"latest {DAG_ID} DAG run"
    log(f"Waiting up to {timeout_seconds}s for {target_description} (polling every {poll_interval_seconds}s).")

    last_observed_dag_run_id: str | None = None
    last_observed_state: str | None = None

    while True:
        dag_run_id, state, polled = get_last_run_info(
            target_dag_run_id,
            target_logical_date,
            poll_request_timeout(),
        )
        if dag_run_id:
            last_observed_dag_run_id = dag_run_id
            last_observed_state = state

        if dag_run_id and state == "success":
            log(f"DAG run: [{dag_run_id}, {state}]")
            print_last_run_logs(poll_request_timeout())
            log("Sample data ingestion completed successfully!")
            return

        if dag_run_id and state == "failed":
            log(f"DAG run [{dag_run_id}] FAILED!")
            dump_diagnostics(dag_run_id, state)
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
    diagnostic_dag_run_id, diagnostic_dag_run_state = dump_diagnostics(
        last_observed_dag_run_id or target_dag_run_id,
        last_observed_state,
    )
    if diagnostic_dag_run_id:
        last_observed_dag_run_id = diagnostic_dag_run_id
        last_observed_state = diagnostic_dag_run_state
    raise SystemExit(
        f"Sample data ingestion did not finish within {timeout_seconds}s "
        f"(last observed run={last_observed_dag_run_id}, state={last_observed_state}). Raise "
        "VALIDATION_TIMEOUT_SECONDS if the run above was still making progress."
    )


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        if exc.code:
            log(f"ERROR: {exc.code}")
        sys.exit(1 if exc.code else 0)
