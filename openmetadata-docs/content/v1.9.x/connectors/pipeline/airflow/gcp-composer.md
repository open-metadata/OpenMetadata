---
title: Extract Metadata from GCP Composer 
slug: /connectors/pipeline/airflow/gcp-composer
---

# Extract Metadata from GCP Composer 

## Requirements

This approach has been last tested against:
- Composer version 2.5.4
- Airflow version 2.6.3

It also requires the ingestion package to be at least `openmetadata-ingestion==1.2.4.3`.

There are 2 main approaches we can follow here to extract metadata from GCS. Both of them involve creating a DAG
directly in your Composer instance, but the requirements and the steps to follow are going to be slightly different.

Feel free to choose whatever approach adapts best to your current architecture and constraints.

## Using the Python Operator

The most comfortable way to extract metadata out of GCP Composer  is by directly creating a DAG in there
that will handle the connection to the metadata database automatically and push the contents
to your OpenMetadata server.

The drawback here? You need to install `openmetadata-ingestion` directly on the host. This might have some
incompatibilities with your current Python environment and/or the internal (and changing) Composer requirements.
In any case, once the requirements are there, preparing the DAG is super straight-forward.

### Install the Requirements

In your environment you will need to install the following packages:

- `openmetadata-ingestion==x.y.z`, (e.g., `openmetadata-ingestion==1.2.4`).
- `sqlalchemy==1.4.27`: This is needed to align OpenMetadata version with the Composer internal requirements.

**Note:** Make sure to use the `openmetadata-ingestion` version that matches the server version
you currently have!

### Prepare the DAG!

Note that this DAG is a usual connector DAG, just using the Airflow service with the `Backend` connection.

As an example of a DAG pushing data to OpenMetadata under Google SSO, we could have:

```python
"""
This DAG can be used directly in your Airflow instance after installing
the `openmetadata-ingestion` package. Its purpose
is to connect to the underlying database, retrieve the information
and push it to OpenMetadata.
"""
from datetime import timedelta

import yaml
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from metadata.workflow.metadata import MetadataWorkflow

 

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60),
}

config = """
source:
  type: airflow
  serviceName: airflow_gcp_composer
  serviceConnection:
    config:
      type: Airflow
      hostPort: http://localhost:8080
      numberOfStatus: 10
      connection:
        type: Backend
  sourceConfig:
    config:
      type: PipelineMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  loggerLevel: INFO
  openMetadataServerConfig:
    hostPort: https://sandbox.getcollate.io/api
    authProvider: google
    securityConfig:
      secretKey: /home/airflow/gcp/data/gcp_creds_beta.json
"""


def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
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

## Using the Kubernetes Pod Operator

In this second approach we won't need to install absolutely anything to the GCP Composer  environment. Instead,
we will rely on the `KubernetesPodOperator` to use the underlying k8s cluster of Composer.

Then, the code won't directly run using the hosts' environment, but rather inside a container that we created
with only the `openmetadata-ingestion` package.

### Requirements

The only thing we need to handle here is getting the URL of the underlying Composer's database. You can follow
the official GCS [docs](https://cloud.google.com/composer/docs/composer-2/access-airflow-database) for the steps to
obtain the credentials.

In a nutshell, from the Airflow UI you can to Admin > Configurations, and search for `sql_alchemy_conn`. In our case,
the URL looked like this:

```
postgresql+psycopg2://root:<pwd>@airflow-sqlproxy-service.composer-system.svc.cluster.local:3306/composer-2-0-28-airflow-2-2-5-5ab01d14
```

As GCS uses Postgres for the backend database, our Airflow connection configuration will be shaped as:

```yaml
connection:
  type: Postgres
  username: root
  password: ...
  hostPort: airflow-sqlproxy-service.composer-system.svc.cluster.local:3306
  database: composer-2-0-28-airflow-2-2-5-5ab01d14
```

For more information on how to shape the YAML describing the Airflow metadata extraction, you can refer 
[here](/connectors/pipeline/airflow/cli#1-define-the-yaml-config).


### Prepare the DAG!

```python
from datetime import datetime

from airflow import models
from airflow.providers.cncf.kubernetes.operators.kubernetes_pod import KubernetesPodOperator


config = """
source:
  type: airflow
  serviceName: airflow_gcp_composer_k8s_op
  serviceConnection:
    config:
      type: Airflow
      hostPort: http://localhost:8080
      numberOfStatus: 10
      connection:
        type: Postgres
        username: root
        password: ...
        hostPort: airflow-sqlproxy-service.composer-system.svc.cluster.local:3306
        database: composer-2-0-28-airflow-2-2-5-5ab01d14
  sourceConfig:
    config:
      type: PipelineMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: https://sandbox.open-metadata.org/api
    enableVersionValidation: false
    authProvider: openmetadata
    securityConfig:
      jwtToken: <JWT>
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
        env_vars={"config": config, "pipelineType": "metadata"},
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

# OpenMetadata Server Config

The easiest approach here is to generate a bot with a **JWT** token directly from the OpenMetadata UI. You can then use
the following workflow config:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
       jwtToken: <JWT>
```
