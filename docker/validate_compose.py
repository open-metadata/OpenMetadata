from typing import Tuple

from pprint import pprint
import requests
from requests.auth import HTTPBasicAuth
import time

HEADER_JSON = {"Content-Type": "application/json"}
BASIC_AUTH = HTTPBasicAuth("admin", "admin")


def get_last_run_info() -> Tuple[str, str]:
    """
    Make sure we can pick up the latest run info
    """
    dag_runs = None
    while not dag_runs:
        print("Waiting for DAG Run data...")
        time.sleep(5)
        runs = requests.get("http://localhost:8080/api/v1/dags/sample_data/dagRuns", auth=BASIC_AUTH).json()
        dag_runs = runs.get("dag_runs")

    return dag_runs[0].get("dag_run_id"), dag_runs[0].get("state")


def print_last_run_logs() -> None:
    """
    Show the logs
    """
    logs = requests.get(
        "http://localhost:8080/api/v1/openmetadata/last_dag_logs?dag_id=sample_data",
        auth=BASIC_AUTH
    ).text
    pprint(logs)


def main():

    state = None
    while state != "success":

        print("Waiting for sample data ingestion to be a success. We'll show some logs along the way.")

        dag_run_id, state = get_last_run_info()
        print(f"DAG run: [{dag_run_id}, {state}]")

        print_last_run_logs()
        time.sleep(10)


if __name__ == "__main__":
    main()
