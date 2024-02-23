---
title: Run the ingestion from your Airflow
slug: /deployment/ingestion/external/airflow
---

{% partial file="/v1.3/deployment/external-ingestion.md" /%}

# Run the ingestion from your Airflow

We can use Airflow in different ways:

1. We can [extract metadata](https://docs.open-metadata.org/connectors/pipeline/airflow) from it,
2. And we can [connect it to the OpenMetadata UI](/deployment/ingestion/openmetadata) to deploy Workflows automatically.

In this guide, we will show how to host the ingestion DAGs in your Airflow directly.

1. [Python Operator](#python-operator)
2. [Docker Operator](#docker-operator)
3. [Python Virtualenv Operator](#python-virtualenv-operator)

## Python Operator

### Prerequisites

Building a DAG using the `PythonOperator` requires devs to install the `openmetadata-ingestion` package in your Airflow's
environment. This is a comfortable approach if you have access to the Airflow host and can freely handle
dependencies.

Installing the dependencies' is as easy as:

```
pip3 install openmetadata-ingestion[<plugin>]==x.y.z
```

Where `x.y.z` is the version of the OpenMetadata ingestion package. Note that the version needs to match the server version. If we are using the server at 1.1.0, then the ingestion package needs to also be 1.1.0.

The plugin parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.1.0`.

### Example

A DAG deployed using a Python Operator would then look like follows

For example, preparing a metadata ingestion DAG with this operator will look as follows:

```python
import yaml
from datetime import timedelta
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.workflow_output_handler import print_status

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
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    print_status(workflow)
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

The drawback here? You need to install some requirements, which is not always possible. Here you have two alternatives,
either you use the `PythonVirtualenvOperator`, or read below on how to run the ingestion with the `DockerOperator`.

{% partial file="/v1.3/deployment/run-connectors-class.md" /%}

## Docker Operator

For this operator, we can use the `openmetadata/ingestion-base` image.
This is useful to prepare DAGs without any installation required on the environment, although it needs for the host
to have access to the Docker commands.

### Prerequisites

The airflow host should be able to run Docker commands.

For example, if you are running Airflow in Docker Compose, that can be achieved preparing a volume mapping the
`docker.sock` file with 600 permissions.

### Example

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
        image="openmetadata/ingestion-base:0.13.2",
        environment={"config": config, "pipelineType": "metadata"},
        docker_url="unix://var/run/docker.sock",  # To allow to start Docker. Needs chmod 666 permissions
        tty=True,
        auto_remove="True",
        network_mode="host",  # To reach the OM server
        task_id="ingest",
        dag=dag,
    )
```

{% note %}

Make sure to tune out the DAG configurations (`schedule_interval`, `start_date`, etc.) as your use case requires.

{% /note %}

Note that the example uses the image `openmetadata/ingestion-base:0.13.2`. Update that accordingly for higher version
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

## Python Virtualenv Operator

You can use the [PythonVirtualenvOperator](https://airflow.apache.org/docs/apache-airflow/stable/howto/operator/python.html#pythonvirtualenvoperator)
when working with an Airflow installation where:
1. You don't want to install dependencies directly on your Airflow host,
2. You don't have any Docker runtime,
3. Your Airflow's Python version is not supported by `openmetadata-ingestion`.

### Prerequisites

As stated in Airflow's [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/operator/python.html#pythonvirtualenvoperator),
your Airflow host should have the `virtualenv` package installed.

Moreover, if you're planning to use a different Python Version in the `virtualenv` than the one your Airflow uses,
you will need that version to be installed in the Airflow host.

For example, if we use Airflow running with Python 3.7 but want the `virtualenv` to use Python 3.9, we need to install
in the host the following packages: `gcc python3.9-dev python3.9-distutils`.

### Example

In this example, we will be using a different Python version that the one Airflow is running:

```python
from datetime import timedelta
from airflow import DAG

try:
    from airflow.operators.python import PythonVirtualenvOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonVirtualenvOperator

from airflow.utils.dates import days_ago

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}


def metadata_ingestion_workflow():
    from metadata.workflow.metadata import MetadataWorkflow
    from metadata.workflow.workflow_output_handler import print_status
    import yaml
    config = """
        ...
    """

    workflow_config = yaml.safe_load(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    print_status(workflow)
    workflow.stop()


with DAG(
    "ingestion_dag",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=True,
    catchup=False,
) as dag:
    ingest_task = PythonVirtualenvOperator(
        task_id="ingest_using_recipe",
        requirements=[
            'openmetadata-ingestion[mysql]~=1.3.0',  # Specify any additional Python package dependencies
        ],
        system_site_packages=False,  # Set to True if you want to include system site-packages in the virtual environment
        python_version="3.9",  # Remove if necessary
        python_callable=metadata_ingestion_workflow
    )
```

Note that the function needs to follow this rules:
- The function must be defined using def, and not be part of a class.
- All imports must happen inside the function
- No variables outside of the scope may be referenced.
