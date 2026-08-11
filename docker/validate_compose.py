import os
import time
from pprint import pprint
from typing import Optional, Tuple

import requests
from metadata.utils.logger import log_ansi_encoded_string


HEADER_JSON = {"Content-Type": "application/json"}
REQUESTS_TIMEOUT = 60 * 5
AIRFLOW_URL = "http://localhost:8080"
USERNAME = "admin"
PASSWORD = "admin"

_access_token: Optional[str] = None
_last_dag_logs_supported: Optional[bool] = None


def get_env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        return int(value)
    except ValueError:
        log_ansi_encoded_string(
            message=f"Invalid integer for {name}: {value}. Falling back to {default}."
        )
        return default


def get_access_token() -> str:
    """Get OAuth access token for Airflow 3.x API."""
    global _access_token

    if _access_token:
        return _access_token

    response = requests.post(
        f"{AIRFLOW_URL}/auth/token",
        headers={"Content-Type": "application/json"},
        json={"username": USERNAME, "password": PASSWORD},
        timeout=10
    )

    if response.status_code == 201:
        data = response.json()
        _access_token = data.get("access_token")
        return _access_token
    else:
        raise Exception(f"Failed to get access token: {response.status_code} - {response.text}")


def get_auth_headers() -> dict:
    """Get authorization headers with Bearer token."""
    token = get_access_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }


def get_last_run_info() -> Tuple[str, str]:
    """
    Make sure we can pick up the latest run info
    """
    max_retries = get_env_int("VALIDATE_COMPOSE_DAG_RUN_RETRIES", 30)
    poll_interval_seconds = get_env_int("VALIDATE_COMPOSE_DAG_RUN_POLL_SECONDS", 5)
    retries = 0

    while retries < max_retries:
        try:
            res = requests.get(
                f"{AIRFLOW_URL}/api/v2/dags/sample_data/dagRuns",
                headers=get_auth_headers(),
                timeout=REQUESTS_TIMEOUT
            )
            res.raise_for_status()
            runs = res.json()
            dag_runs = runs.get("dag_runs", [])

            if dag_runs and len(dag_runs) > 0:
                # Sort by logical_date descending to get the latest run
                dag_runs_sorted = sorted(
                    dag_runs,
                    key=lambda x: x.get("logical_date", ""),
                    reverse=True
                )
                dag_run = dag_runs_sorted[0]
                dag_run_id = dag_run.get("dag_run_id")
                state = dag_run.get("state", "").lower()

                if dag_run_id:
                    log_ansi_encoded_string(
                        message=f"Found DAG run: {dag_run_id} with state: {state}"
                    )
                    return dag_run_id, state
            else:
                log_ansi_encoded_string(message="No DAG runs found yet, waiting...")

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                global _access_token
                _access_token = None
            log_ansi_encoded_string(message=f"Error getting DAG runs: {e}")

        time.sleep(poll_interval_seconds)
        retries += 1

    return None, None


def print_last_run_logs() -> None:
    """
    Show the logs
    """
    global _last_dag_logs_supported

    try:
        response = requests.get(
            f"{AIRFLOW_URL}/api/v2/openmetadata/last_dag_logs?dag_id=sample_data&task_id=ingest_using_recipe",
            headers=get_auth_headers(),
            timeout=REQUESTS_TIMEOUT
        )

        if response.status_code == 404:
            if _last_dag_logs_supported is not False:
                log_ansi_encoded_string(
                    message="Airflow last_dag_logs route is unavailable. Skipping task log fetch."
                )
                _last_dag_logs_supported = False
            return

        response.raise_for_status()
        _last_dag_logs_supported = True
        pprint(response.text)
    except Exception as e:
        log_ansi_encoded_string(message=f"Could not fetch logs: {e}")


def main():
    max_retries = get_env_int("VALIDATE_COMPOSE_MAX_RETRIES", 15)
    retry_interval_seconds = get_env_int("VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS", 10)
    retries = 0

    while retries < max_retries:
        dag_run_id, state = get_last_run_info()

        if not dag_run_id:
            log_ansi_encoded_string(
                message="Waiting for DAG run to start...",
            )
            time.sleep(retry_interval_seconds)
            retries += 1
            continue

        if state == "success":
            log_ansi_encoded_string(message=f"DAG run: [{dag_run_id}, {state}]")
            print_last_run_logs()
            log_ansi_encoded_string(message="Sample data ingestion completed successfully!")
            break
        elif state in ["running", "queued"]:
            log_ansi_encoded_string(
                message=f"DAG run [{dag_run_id}] is {state}. Waiting for completion...",
            )
            print_last_run_logs()
            time.sleep(retry_interval_seconds)
            retries += 1
        elif state == "failed":
            log_ansi_encoded_string(message=f"DAG run [{dag_run_id}] FAILED!")
            print_last_run_logs()
            raise Exception(f"Sample data ingestion failed. DAG run state: {state}")
        else:
            log_ansi_encoded_string(
                message=f"Waiting for sample data ingestion. Current state: {state}",
            )
            print_last_run_logs()
            time.sleep(retry_interval_seconds)
            retries += 1

    if retries == max_retries:
        raise Exception("Max retries exceeded. Sample data ingestion was not successful.")


if __name__ == "__main__":
    main()
