---
title: Run the ingestion from your Airflow
description: Deploy ingestion externally using Airflow for scalable orchestration of metadata pipelines across environments.
slug: /deployment/ingestion/external/airflow
collate: false
---

{% partial file="/v1.9/deployment/external-ingestion.md" /%}

# Run the ingestion from your Airflow

OpenMetadata integrates with Airflow to orchestrate ingestion workflows. You can use Airflow to [extract metadata](/connectors/pipeline/airflow) and [deploy workflows] (/deployment/ingestion/openmetadata) directly. This guide explains how to run ingestion workflows in Airflow using three different operators:

1. [Python Operator](#python-operator)
2. [Docker Operator](#docker-operator)
3. [Python Virtualenv Operator](#python-virtualenv-operator)

## Using the Python Operator

### Prerequisites

Install the `openmetadata-ingestion` package in your Airflow environment. This approach works best if you have access to the Airflow host and can manage dependencies.

#### Installation Command:

```
pip3 install openmetadata-ingestion[<plugin>]==x.y.z
```
-Replace [<plugin>](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/setup.py) with the sources to ingest, such as mysql, snowflake, or s3.
-Replace x.y.z with the OpenMetadata version matching your server (e.g., 1.6.1).

### Example
```
pip3 install openmetadata-ingestion[mysql,snowflake,s3]==1.6.1
```
### Example DAG

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

### Key Notes

- **Function Setup**: The `python_callable` argument in the `PythonOperator` executes the `metadata_ingestion_workflow` function, which instantiates the workflow and runs the ingestion process.
- **Drawback**: This method requires pre-installed dependencies, which may not always be feasible. Consider using the **DockerOperator** or **PythonVirtualenvOperator** as alternatives.

## Using the Docker Operator

For this operator, we can use the `openmetadata/ingestion-base` image. This is useful to prepare DAGs without any installation required on the environment, although it needs for the host to have access to the Docker commands.

### Prerequisites

Ensure the Airflow host can run Docker commands. For Docker Compose setups, map the Docker socket as follows:

### Example

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:z  # Need 666 permissions to run DockerOperator
```

### Example DAG

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

{% note %}

If you encounter issues such as missing task instances or Airflow failing to locate a deployed DAG (e.g., `Dag '<DAG_ID>' could not be found`), this may be due to a **timezone mismatch** in your Airflow configuration. To resolve this, set the following in your `airflow.cfg`:

```ini
default_timezone = system
```

This ensures that Airflow uses the system timezone, which is particularly important when OpenMetadata and Airflow are running on the same server.

{% /note %}

### Key Notes

- **Image Version**: Ensure the Docker image version matches your OpenMetadata server version (e.g., `openmetadata/ingestion-base:0.13.2`).  
- **Pipeline Types**: Set the `pipelineType` to `metadata`, `usage`, `lineage`, `profiler`, or other supported values.  
- **No Installation Required**: The `DockerOperator` eliminates the need to install dependencies directly on the Airflow host.

Another important point here is making sure that the Airflow will be able to run Docker commands to create the task.
As our example was done with Airflow in Docker Compose, that meant setting `docker_url="unix://var/run/docker.sock"`.

The final important elements here are:
- `command="python main.py"`: This does not need to be modified, as we are shipping the `main.py` script in the
  image, used to trigger the workflow.
- `environment={"config": config, "pipelineType": "metadata"}`: Again, in most cases you will just need to update
  the `config` string to point to the right connector.

Other supported values of `pipelineType` are `usage`, `lineage`, `profiler`, `dataInsight`, `elasticSearchReindex`, `dbt`, `application` or `TestSuite`. Pass the required flag
depending on the type of workflow you want to execute. Make sure that the YAML config reflects what ingredients
are required for your Workflow.

## Using the Python Virtualenv Operator

### Prerequisites

As stated in Airflow's [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/operator/python.html#pythonvirtualenvoperator), install the `virtualenv` package on the Airflow host.If using a different Python version in the virtual environment (e.g., Python 3.9 while Airflow uses 3.7), install additional packages such as:
```
gcc python3.9-dev python3.9-distutils
```
### Example DAG

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
     
    import yaml
    config = """
        source:
          type: postgres
          serviceName: local_postgres
          serviceConnection:
            config:
              type: Postgres
              username: openmetadata_user
              authType:
                password: openmetadata_password
              hostPort: localhost:5432
              database: pagila
          sourceConfig:
            config:
              type: DatabaseMetadata
        sink:
          type: metadata-rest
          config: {}
        workflowConfig:
          # loggerLevel: INFO # DEBUG, INFO, WARN or ERROR
          openMetadataServerConfig:
            hostPort: http://localhost:8585/api
            authProvider: openmetadata
            securityConfig:
              jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5
    """

    workflow_config = yaml.safe_load(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
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

### Key Notes

**Function Rules**:  
- Use a `def` function (not part of a class).  
- All imports must occur inside the function.  
- Avoid referencing variables outside the function's scope.

{% partial file="/v1.9/deployment/run-connectors-class.md" /%}
