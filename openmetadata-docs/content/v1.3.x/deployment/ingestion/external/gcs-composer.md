---
title: Run the ingestion from GCS Composer
slug: /deployment/ingestion/external/gcs-composer
---

{% partial file="/v1.3/deployment/external-ingestion.md" /%}

# Run the ingestion from GCS Composer

## Requirements

This approach has been last tested against:
- Composer version 2.5.4
- Airflow version 2.6.3

It also requires the ingestion package to be at least `openmetadata-ingestion==1.3.1.0`.

## Using the Python Operator

The most comfortable way to run the metadata workflows from GCS Composer is directly via a `PythonOperator`. Note that
it will require you to install the packages and plugins directly on the host.

### Install the Requirements

In your environment you will need to install the following packages:

- `openmetadata-ingestion[<plugins>]==x.y.z`.
- `sqlalchemy==1.4.27`: This is needed to align OpenMetadata version with the Composer internal requirements.

Where `x.y.z` is the version of the OpenMetadata ingestion package. Note that the version needs to match the server version. If we are using the server at 1.1.0, then the ingestion package needs to also be 1.1.0.

The plugin parameter is a list of the sources that we want to ingest. An example would look like this `openmetadata-ingestion[mysql,snowflake,s3]==1.1.0`.

### Prepare the DAG!

Note that this DAG is a usual connector DAG, just using the Airflow service with the `Backend` connection.

As an example of a DAG pushing data to OpenMetadata under Google SSO, we could have:

```python
from datetime import timedelta

import yaml
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from metadata.workflow.metadata import MetadataWorkflow

from metadata.workflow.workflow_output_handler import print_status

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60),
}

CONFIG = """
...
"""


def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(CONFIG)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    print_status(workflow)
    workflow.stop()


with DAG(
    "airflow_metadata_extraction",
    default_args=default_args,
    description="An example DAG which pushes Airflow data to OM",
    start_date=days_ago(1),
    is_paused_upon_creation=True,
    schedule_interval="*/5 * * * *",
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```

{% partial file="/v1.3/deployment/run-connectors-class.md" /%}

## Using the Kubernetes Pod Operator

In this second approach we won't need to install absolutely anything to the GCS Composer environment. Instead,
we will rely on the `KubernetesPodOperator` to use the underlying k8s cluster of Composer.

Then, the code won't directly run using the hosts' environment, but rather inside a container that we created
with only the `openmetadata-ingestion` package.

**Note:** This approach only has the `openmetadata/ingestion-base` ready from version 0.12.1 or higher!

### Prepare the DAG!

```python
from datetime import datetime

from airflow import models
from airflow.providers.cncf.kubernetes.operators.kubernetes_pod import KubernetesPodOperator


CONFIG = """
...
"""


with models.DAG(
    "ingestion-k8s-operator",
    schedule_interval="@once",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["OpenMetadata"],
) as dag:
    KubernetesPodOperator(
        task_id="ingest",
        name="ingest",
        cmds=["python", "main.py"],
        image="openmetadata/ingestion-base:0.13.2",
        namespace='default',
        env_vars={"config": CONFIG, "pipelineType": "metadata"},
        dag=dag,
    )
```

Some remarks on this example code:

#### Kubernetes Pod Operator

You can name the task as you want (`task_id` and `name`). The important points here are the `cmds`, this should not
be changed, and the `env_vars`. The `main.py` script that gets shipped within the image will load the env vars
as they are shown, so only modify the content of the config YAML, but not this dictionary.

Note that the example uses the image `openmetadata/ingestion-base:0.13.2`. Update that accordingly for higher version
once they are released. Also, the image version should be aligned with your OpenMetadata server version to avoid
incompatibilities.

```python
KubernetesPodOperator(
    task_id="ingest",
    name="ingest",
    cmds=["python", "main.py"],
    image="openmetadata/ingestion-base:0.13.2",
    namespace='default',
    env_vars={"config": config, "pipelineType": "metadata"},
    dag=dag,
)
```

You can find more information about the `KubernetesPodOperator` and how to tune its configurations
[here](https://cloud.google.com/composer/docs/how-to/using/using-kubernetes-pod-operator).

Note that depending on the kind of workflow you will be deploying, the YAML configuration will need to updated following
the official OpenMetadata docs, and the value of the `pipelineType` configuration will need to hold one of the following values:

- `metadata`
- `usage`
- `lineage`
- `profiler`
- `TestSuite`

Which are based on the `PipelineType` [JSON Schema definitions](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/ingestionPipeline.json#L14)
