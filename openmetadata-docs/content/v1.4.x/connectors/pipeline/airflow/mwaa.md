---
title: Extract MWAA Metadata
slug: /connectors/pipeline/airflow/mwaa
---

# Extract MWAA Metadata

To extract MWAA Metadata we need to run the ingestion **from** MWAA, since the underlying database lives in a private network.

To learn how to run connectors from MWAA, you can take a look at this [doc](/deployment/ingestion/mwaa). In this guide,
we'll explain how to configure the MWAA ingestion in the 3 supported approaches:

1. Install the openmetadata-ingestion package as a requirement in the Airflow environment. We will then run the process using a `PythonOperator`
2. Configure an ECS cluster and run the ingestion as an ECS Operator.
3. Install a plugin and run the ingestion with the `PythonVirtualenvOperator`.

## 1. Extracting MWAA Metadata with the PythonOperator

As the ingestion process will be happening locally in MWAA, we can prepare a DAG with the following YAML
configuration:

```yaml
source:
  type: airflow
  serviceName: airflow_mwaa
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
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

## 2. Extracting MWAA Metadata with the ECS Operator

After setting up the ECS Cluster, you'll need first to check the MWAA database connection

### Getting MWAA database connection

To extract MWAA information we will need to take a couple of points in consideration:
1. How to get the underlying database connection info, and
2. How to make sure we can reach such database.

The happy path would be going to the `Airflow UI > Admin > Configurations` and finding the `sql_alchemy_conn` parameter.

However, MWAA is not providing this information. Instead, we need to create a DAG to get the connection details
once. The DAG can be deleted afterwards. We want to use a Python Operator that will retrieve the Airflow's Session data:

```python
import logging
import os
from datetime import timedelta

import yaml
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from airflow.configuration import conf

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60),
}

def get_data():
    from airflow.settings import Session

    logging.info("SQL ALCHEMY CONN")
    sqlalchemy_conn = conf.get("core", "sql_alchemy_conn", fallback=None)
    logging.info(sqlalchemy_conn)


with DAG(
    "airflow_database_connection",
    default_args=default_args,
    description="An example DAG which pushes Airflow data to OM",
    start_date=days_ago(1),
    is_paused_upon_creation=True,
    schedule_interval="@once",
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="db_connection",
        python_callable=get_data,
    )
```

After running the DAG, we can store the connection details and remove the dag file from S3.

Note that trying to log the `conf.get("core", "sql_alchemy_conn", fallback=None)` details might either result in:
1. An empty string, depending on the Airflow version: If that's the case, you can use update the line to be `conf.get("database", "sql_alchemy_conn", fallback=None)`.
2. The password masked in `****`. If that's the case, you can use `sqlalchemy_conn = list(conf.get("core", "sql_alchemy_conn", fallback=None))`,
  which will return the results separated by commas.


#### Preparing the metadata extraction

Then, prepare the YAML config with the information you retrieved above. For example:

```yaml
source:
  type: airflow
  serviceName: airflow_mwaa_ecs_op
  serviceConnection:
    config:
      type: Airflow
      hostPort: http://localhost:8080
      numberOfStatus: 10
      connection:
        type: Postgres
        username: adminuser
        password: ...
        hostPort: vpce-075b93a08ef7a8ffc-c88g16we.vpce-svc-0dfc8a341f816c134.us-east-2.vpce.amazonaws.com:5432
        database: AirflowMetadata
  sourceConfig:
    config:
      type: PipelineMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    enableVersionValidation: false
    hostPort: https://sandbox.open-metadata.org/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: ...
```

## 2. Extracting MWAA Metadata with the Python Virtualenv Operator

This will be similar as the first step, where you just need the simple `Backend` connection YAML:

```yaml
source:
  type: airflow
  serviceName: airflow_mwaa
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
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```
