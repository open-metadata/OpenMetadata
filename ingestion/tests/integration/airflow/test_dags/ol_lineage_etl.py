"""
DAG with OpenLineage Dataset inlets/outlets for E2E lineage testing.

When this DAG runs with the OL provider installed and transport configured,
Airflow 3.x emits COMPLETE events with these datasets as inputs/outputs.
The OM OpenLineage endpoint resolves them to existing sample_data tables.
"""
from datetime import datetime, timezone

from airflow.decorators import dag, task
from openlineage.client.event_v2 import Dataset

RAW_ORDER = Dataset(
    namespace="sample_data",
    name="ecommerce_db.shopify.raw_order",
)
FACT_ORDER = Dataset(
    namespace="sample_data",
    name="ecommerce_db.shopify.fact_order",
)


@dag(
    dag_id="ol_lineage_etl",
    description="ETL with OpenLineage inlets/outlets for E2E lineage testing",
    schedule=None,
    start_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
    catchup=False,
    is_paused_upon_creation=True,
    tags=["e2e_test", "openlineage", "lineage"],
)
def ol_lineage_etl():
    @task(inlets=[RAW_ORDER], outlets=[FACT_ORDER])
    def transform():
        print("Transforming raw_order -> fact_order")

    transform()


ol_lineage_etl()
