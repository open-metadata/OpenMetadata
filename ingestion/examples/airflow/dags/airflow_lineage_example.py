#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
OpenMetadata Airflow Lineage Backend example. Airflow provides a pluggable lineage backend that can
read a DAG's configured inlets and outlets to compose a lineage. With OpenMetadata we have a airflow lineage backend
to get all of the workflows in Airflow and also any lineage user's configured.

IMPORTANT: This DAG requires the OpenMetadata Lineage Backend to be configured.
To enable it, set the following environment variables before starting Airflow:

    export OPENMETADATA_LINEAGE_ENABLED=true
    export AIRFLOW__LINEAGE__JWT_TOKEN=<your-openmetadata-jwt-token>

The ingestion_dependency.sh script will automatically configure the lineage backend when
OPENMETADATA_LINEAGE_ENABLED=true is set.

Please refer to https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-backend on how to configure the lineage backend
with Airflow Scheduler

This is an example to demonstrate on how to configure a Airflow DAG's inlets and outlets.
"""


from datetime import datetime, timedelta

from airflow.decorators import dag, task

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
    schedule=timedelta(days=1),
    start_date=datetime(2024, 1, 1),
    catchup=False,
    is_paused_upon_creation=True,
)
def openmetadata_airflow_lineage_example():
    """
    This DAG demonstrates three different patterns for defining lineage with inlets and outlets.

    Requirements:
    1. OpenMetadata server must be accessible
    2. AIRFLOW__LINEAGE__* environment variables must be configured (see LINEAGE_SETUP.md)
    3. Set OPENMETADATA_LINEAGE_ENABLED=true before starting Airflow
    """

    # Example 1: Simple dict with tables list
    @task(
        inlets={"tables": ["sample_data.ecommerce_db.shopify.raw_order"]},
        outlets={"tables": ["sample_data.ecommerce_db.shopify.fact_order"]},
    )
    def generate_data():
        """Task demonstrating simple lineage with table FQNs"""
        pass

    # Example 2: Using OMEntity objects
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
        """Task demonstrating lineage with OMEntity objects"""
        pass

    # Example 3: Using dict with entity type
    @task(
        inlets=[
            {
                "entity": "container",
                "fqn": "s3_storage_sample.departments",
                "key": "test",
            }
        ],
        outlets=[
            {
                "entity": "table",
                "fqn": "sample_data.ecommerce_db.shopify.raw_order",
                "key": "test",
            }
        ],
    )
    def generate_data3():
        """Task demonstrating lineage with dict-based entity definitions"""
        pass

    generate_data()
    generate_data2()
    generate_data3()


openmetadata_airflow_lineage_example_dag = openmetadata_airflow_lineage_example()
