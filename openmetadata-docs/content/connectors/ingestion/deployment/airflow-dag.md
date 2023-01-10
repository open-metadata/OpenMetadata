---
title: Run Connectors in your own Airflow
slug: /connectors/ingestion/run-connectors-in-airflow
---

# Run Connectors in your Airflow

We can use Airflow in different ways:
1. We can [extract metadata](https://docs.open-metadata.org/connectors/pipeline/airflow) from it,
2. And we can use [connect to the OpenMetadata UI](https://docs.open-metadata.org/deployment/airflow) to deploy Workflows automatically.

In this guide, we will show how to host the ingestion DAGs in your Airflow directly. Note that in each connector
page (e.g., [Snowflake](https://docs.open-metadata.org/connectors/database/snowflake/airflow)) we are showing
an example on how to prepare a YAML configuration and run it as a DAG.

Here we are going to explain that a bit deeper and show an alternative process to achieve the same result.

## Python Operator

Building a DAG using the `PythonOperator` requires devs to install the `openmetadata-ingestion` package in your Airflow's
environment. This is a comfortable approach if you have access to the Airflow host and can freely handle
dependencies.

Installing the dependencies' is as easy as `pip3 install "openmetadata-ingestion[<your-connector>]"`.

For example, preparing a metadata ingestion DAG with this operator will look as follows:

```python
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow
from airflow.utils.dates import days_ago

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60)
}

config = """
<your YAML configuration>
"""

def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

with DAG(
    "sample_data",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    schedule_interval='*/5 * * * *',
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```

Note how we are preparing the `PythonOperator` by passing the `python_callable=metadata_ingestion_workflow` as
an argument, where `metadata_ingestion_workflow` is a function that instantiates the `Workflow` class and runs
the whole process.

The drawback here? You need to install some requirements, which is not always possible. This is why on 0.12.1 and higher
versions we introduced an alternative approach. More on that below!

## Docker Operator

From version 0.12.1 we are shipping a new image `openmetadata/ingestion-base`, which only contains the `openmetadata-ingestion`
package and can then be used to handle ingestions in an isolated environment.

This is useful to prepare DAGs without any installation required on the environment, although it needs for the host
to have access to the Docker commands.

For example, if you are running Airflow in Docker Compose, that can be achieved preparing a volume mapping the
`docker.sock` file with 600 permissions.

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:z  # Need 666 permissions to run DockerOperator
```

Then, preparing a DAG looks like this:

```python
from datetime import datetime

from airflow import models
from airflow.providers.docker.operators.docker import DockerOperator


config = """
<your YAML configuration>
"""

with models.DAG(
    "ingestion-docker-operator",
    schedule_interval='*/5 * * * *',
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["OpenMetadata"],
) as dag:
    DockerOperator(
        command="python main.py",
        image="openmetadata/ingestion-base:0.13.1",
        environment={"config": config, "pipelineType": "metadata"},
        docker_url="unix://var/run/docker.sock",  # To allow to start Docker. Needs chmod 666 permissions
        tty=True,
        auto_remove="True",
        network_mode="host",  # To reach the OM server
        task_id="ingest",
        dag=dag,
    )
```

<Note>

Make sure to tune out the DAG configurations (`schedule_interval`, `start_date`, etc.) as your use case requires.

</Note>

Note that the example uses the image `openmetadata/ingestion-base:0.13.1`. Update that accordingly for higher version
once they are released. Also, the image version should be aligned with your OpenMetadata server version to avoid
incompatibilities.

Another important point here is making sure that the Airflow will be able to run Docker commands to create the task.
As our example was done with Airflow in Docker Compose, that meant setting `docker_url="unix://var/run/docker.sock"`.

The final important elements here are:
- `command="python main.py"`: This does not need to be modified, as we are shipping the `main.py` script in the
  image, used to trigger the workflow.
- `environment={"config": config, "pipelineType": "metadata"}`: Again, in most cases you will just need to update
  the `config` string to point to the right connector.

Other supported values of `pipelineType` are `usage`, `lineage`, `profiler` or `TestSuite`. Pass the required flag
depending on the type of workflow you want to execute. Make sure that the YAML config reflects what ingredients
are required for your Workflow.
