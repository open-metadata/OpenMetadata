from typing import Tuple

from pprint import pprint
import requests
import time

HEADER_AUTH = {"Authorization": "Basic YWRtaW46YWRtaW4="}
HEADER_JSON = {"Content-Type": "application/json"}


def get_apis_token_header() -> dict:
    """
    Get our APIs token
    """
    req = requests.post(
        "http://localhost:8080/api/v1/security/login",
        json={"username": "admin", "password": "admin", "refresh": "true", "provider": "db"},
        headers=HEADER_JSON,
    ).json()

    return {"Authorization": f"Bearer {req.get('access_token')}"}


def get_last_run_info() -> Tuple[str, str]:
    """
    Make sure we can pick up the latest run info
    """
    dag_runs = None
    while not dag_runs:
        print("Waiting for DAG Run data...")
        time.sleep(5)
        runs = requests.get("http://localhost:8080/api/v1/dags/sample_data/dagRuns", headers=HEADER_AUTH).json()
        dag_runs = runs.get("dag_runs")

    return dag_runs[0].get("dag_run_id"), dag_runs[0].get("state")


def print_last_run_logs() -> None:
    """
    Show the logs
    """
    token = get_apis_token_header()
    logs = requests.get(
        "http://localhost:8080/rest_api/api?api=last_dag_logs&dag_id=sample_data",
        headers={**HEADER_JSON, **token}
    ).text
    pprint(logs)


def main():

    state = None
    while state != "success":

        print("Waiting for sample data to be a success. We'll show some logs along the way.")

        dag_run_id, state = get_last_run_info()
        print(f"DAG run: [{dag_run_id}, {state}]")

        print_last_run_logs()


if __name__ == "__main__":
    main()
