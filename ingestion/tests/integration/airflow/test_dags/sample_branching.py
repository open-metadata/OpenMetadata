"""
Sample branching DAG for AirflowApi connector E2E testing.
Tests that parallel task structures are captured correctly.
"""
from datetime import datetime

from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "test_owner",
    "depends_on_past": False,
    "retries": 0,
}

with DAG(
    dag_id="sample_branching",
    default_args=default_args,
    description="Branching pipeline for E2E testing",
    schedule=None,
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["e2e_test"],
) as dag:
    start = BashOperator(task_id="start", bash_command="echo start")
    branch_a = BashOperator(task_id="branch_a", bash_command="echo branch_a")
    branch_b = BashOperator(task_id="branch_b", bash_command="echo branch_b")
    join = BashOperator(task_id="join", bash_command="echo join")
    start >> [branch_a, branch_b] >> join
