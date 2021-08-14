# Airflow

We highly recommend using Airflow or similar schedulers to run Metadata Connectors. Below is the sample code example you can refer to integrate with Airflow

## Airflow Example for Hive

```python
from datetime import timedelta
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": True,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60),
}


def metadata_ingestion_workflow():
    config = load_config_file("examples/workflows/hive.json")
    workflow = Workflow.create(config)
    workflow.run()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


with DAG(
    "hive_metadata_ingestion_workflow"
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    schedule_interval=timedelta(days=1),
    start_date=days_ago(30),
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow(),
    )
```

we are using a python method like below

```python
def metadata_ingestion_workflow():
    config = load_config_file("examples/workflows/hive.json")
    workflow = Workflow.create(config)
    workflow.run()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()
```

Create a Workflow instance and pass a hive configuration which will read metadata from Hive
and ingest into OpenMetadata Server. You can customize this configuration or add different connectors please refer to our [examples](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/examples/workflows) and refer to [Metadata Connectors](

