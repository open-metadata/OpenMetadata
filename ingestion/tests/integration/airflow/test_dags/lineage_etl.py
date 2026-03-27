"""
DAG that triggers OpenLineage events with inlets/outlets for lineage testing.
Uses Airflow 3.x native OpenLineage support.
"""
from datetime import datetime

from airflow import DAG
from airflow.lineage.entities import Table as LineageTable
from airflow.operators.bash import BashOperator

default_args = {
    "owner": "test_owner",
    "depends_on_past": False,
    "retries": 0,
}

inlet_table = LineageTable(
    cluster="default",
    database="test_db",
    name="source_table",
)

outlet_table = LineageTable(
    cluster="default",
    database="test_db",
    name="target_table",
)

with DAG(
    dag_id="lineage_etl",
    default_args=default_args,
    description="ETL pipeline with lineage for E2E testing",
    schedule=None,
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["e2e_test", "lineage"],
) as dag:
    extract = BashOperator(
        task_id="extract",
        bash_command="echo extracting data from source",
        inlets=[inlet_table],
    )
    transform = BashOperator(
        task_id="transform",
        bash_command="echo transforming data",
    )
    load = BashOperator(
        task_id="load",
        bash_command="echo loading data to target",
        outlets=[outlet_table],
    )
    extract >> transform >> load
