"""
Sample ETL DAG for AirflowApi connector E2E testing.
A simple 3-task DAG: extract -> transform -> load
"""
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "test_owner",
    "depends_on_past": False,
    "retries": 0,
}

with DAG(
    dag_id="sample_etl",
    default_args=default_args,
    description="Sample ETL pipeline for E2E testing",
    schedule=timedelta(days=1),
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["e2e_test", "etl"],
) as dag:
    extract = BashOperator(task_id="extract", bash_command="echo extracting")
    transform = BashOperator(task_id="transform", bash_command="echo transforming")
    load = BashOperator(task_id="load", bash_command="echo loading")
    extract >> transform >> load
