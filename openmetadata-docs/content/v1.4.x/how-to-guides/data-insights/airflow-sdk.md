---
title: Run Data Insights using Airflow SDK
slug: /how-to-guides/data-insights/airflow-sdk
---

# Run Data Insights using Airflow SDK

## 1. Define the YAML Config

This is a sample config for Data Insights:

```yaml
source:
  type: dataInsight
  serviceName: OpenMetadata
  sourceConfig:
    config:
      type: MetadataToElasticSearch
processor:
  type: data-insight-processor
  config: {}
sink:
  type: elasticsearch
  config:
    es_host: localhost
    es_port: 9200
    recreate_indexes: false
workflowConfig:
  loggerLevel: DEBUG
  openMetadataServerConfig:
    hostPort: '<OpenMetadata host and port>'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

### Source Configuration - Source Config

- To send the metadata to OpenMetadata, it needs to be specified as `type: MetadataToElasticSearch`.

### Processor Configuration

- To send the metadata to OpenMetadata, it needs to be specified as `type: data-insight-processor`.

### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).
You can find the different implementation of the ingestion below.

## 2. Prepare the Data Insights DAG

Create a Python file in your Airflow DAGs directory with the following contents:

```python
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG
from metadata.workflow.data_insight import DataInsightWorkflow
from metadata.workflow.workflow_output_handler import print_status

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
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
    workflow = DataInsightWorkflow.create(workflow_config)
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
