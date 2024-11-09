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
Please refer to https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-backend on how to configure the lineage backend
with Airflow Scheduler
This is an example to demonstrate on how to configure a Airflow DAG's inlets and outlets
"""


from datetime import timedelta

from airflow.decorators import dag, task
from airflow.utils.dates import days_ago

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.source.pipeline.airflow.lineage_parser import OMEntity

default_args = {
    "owner": "openmetadata_airflow_example",
    "depends_on_past": False,
    "email": ["user@company.com"],
    "execution_timeout": timedelta(minutes=5),
}


@dag(
    default_args=default_args,
    dag_id="sample_lineage",
    description="OpenMetadata Airflow Lineage example DAG",
    schedule_interval=timedelta(days=1),
    start_date=days_ago(1),
    catchup=False,
)
def openmetadata_airflow_lineage_example():
    @task(
        inlets={
            "tables": [
                "sample_data.ecommerce_db.shopify.raw_order",
            ],
        },
        outlets={"tables": ["sample_data.ecommerce_db.shopify.fact_order"]},
    )
    def generate_data():
        pass

    @task(
        inlets=[
            OMEntity(entity=Container, fqn="s3_storage_sample.transactions", key="test")
        ],
        outlets=[
            OMEntity(
                entity=Table,
                fqn="sample_data.ecommerce_db.shopify.raw_order",
                key="test",
            )
        ],
    )
    def generate_data2():
        pass

    @task(
        inlets=[
            {
                "entity": "container",
                "fqn": "s3_storage_sample.departments",
                "key": "test",
            },
        ],
        outlets=[
            {
                "entity": "table",
                "fqn": "sample_data.ecommerce_db.shopify.raw_order",
                "key": "test",
            },
        ],
    )
    def generate_data3():
        pass

    generate_data()
    generate_data2()
    generate_data3()


openmetadata_airflow_lineage_example_dag = openmetadata_airflow_lineage_example()
