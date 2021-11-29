"""
OpenMetadata Airflow Lineage Backend example. Airflow provides a pluggable lineage backend that can
read a DAG's configured inlets and outlets to compose a lineage. With OpenMetadata we have a airflow lineage backend
to get all of the workflows in Airflow and also any lineage user's configured.
Please refer to https://docs.open-metadata.org/lineage/configure-airflow-lineage on how to configure the lineage backend
with Airflow Scheduler
This is an example to demonstrate on how to configure a Airflow DAG's inlets and outlets
"""


from datetime import timedelta

from airflow.decorators import dag, task
from airflow.utils.dates import days_ago

from metadata.ingestion.models.table_metadata import Table

default_args = {
    "owner": "openmetadata_airflow_example",
    "depends_on_past": False,
    "email": ["user@company.com"],
    "execution_timeout": timedelta(minutes=5),
}


@dag(
    default_args=default_args,
    description="OpenMetadata Airflow Lineage example DAG",
    schedule_interval=timedelta(days=1),
    start_date=days_ago(1),
    catchup=False,
)
def openmetadata_airflow_lineage_example():
    @task(
        inlets={
            "tables": [
                Table(fullyQualifiedName="bigquery_gcp.shopify.raw_order"),
                Table(fullyQualifiedName="bigquery_gcp.shopify.raw_customer"),
            ],
        },
        outlets={
            "tables": [Table(fullyQualifiedName="bigquery_gcp.shopify.fact_order")]
        },
    )
    def generate_data():
        """write your query to generate ETL"""
        pass

    generate_data()


openmetadata_airflow_lineage_example_dag = openmetadata_airflow_lineage_example()
