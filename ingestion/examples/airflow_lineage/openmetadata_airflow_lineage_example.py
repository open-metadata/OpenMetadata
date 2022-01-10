#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

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

from metadata.ingestion.models.table_metadata import TableFQDN

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
                TableFQDN(fullyQualifiedName="bigquery_gcp.shopify.raw_order"),
                TableFQDN(fullyQualifiedName="bigquery_gcp.shopify.raw_customer"),
            ],
        },
        outlets={
            "tables": [TableFQDN(fullyQualifiedName="bigquery_gcp.shopify.fact_order")]
        },
    )
    def generate_data():
        """write your query to generate ETL"""
        pass

    generate_data()


openmetadata_airflow_lineage_example_dag = openmetadata_airflow_lineage_example()
