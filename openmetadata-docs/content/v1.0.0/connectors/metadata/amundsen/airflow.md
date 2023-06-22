---
title: Run Amundsen Connector using Airflow SDK
slug: /connectors/metadata/amundsen/airflow
---

# Run Amundsen using the Airflow SDK


| Feature                     | Status                       |
| :----------------------     | :--------------------------- |
| Table Metadata              | {% icon iconName="check" /%} |
| Table Owner                 | {% icon iconName="check" /%} |
| Classifications/Tags        | {% icon iconName="check" /%} |
| Dashboard & Chart Metadata  | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the Amundsen connector.

Configure and schedule Amundsen metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)


## Requirements

Before this, you must ingest the database / messaging service you want to get metadata for. 
For more details click [here](/connectors/metadata/amundsen#create-database-service)

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

### Python Requirements

To run the Amundsen ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[amundsen]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/amundsenConnection.json)
you can find the structure to create a connection to Amundsen.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Amundsen:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=12 %}

**hostPort**: Host and port of the Amundsen Neo4j Connection. This expect a URI format like: bolt://localhost:7687.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

**username**: Username to connect to the Amundsen. This user should have privileges to read all the metadata in Amundsen.

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**password**: Password to connect to the Amundsen.

{% /codeInfo %}

{% codeInfo srNumber=15 %}

**maxConnectionLifeTime**: Maximum connection lifetime for the Amundsen Neo4j Connection.

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**validateSSL**: Enable SSL validation for the Amundsen Neo4j Connection.

{% /codeInfo %}

{% codeInfo srNumber=17 %}

**encrypted**: Enable encryption for the Amundsen Neo4j Connection.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=18 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=19 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}
{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: Amundsen
  serviceName: local_amundsen
  serviceConnection:
    config:
      type: Amundsen
```
```yaml {% srNumber=12 %}
      hostPort: http://localhost:10000
```
```yaml {% srNumber=13 %}
      username: username
```
```yaml {% srNumber=14 %}
      password: password
```
```yaml {% srNumber=15 %}
      maxConnectionLifeTime: 50
```
```yaml {% srNumber=16 %}
      validateSSL: false
```
```yaml {% srNumber=17 %}
      encrypted: false
```
```yaml
  sourceConfig:
    config:
      type: DatabaseMetadata
```
```yaml {% srNumber=18 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=19 %}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

{% /codeBlock %}

{% /codePreview %}


### Workflow Configs for Security Provider

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).

## Openmetadata JWT Auth

- JWT tokens will allow your clients to authenticate against the OpenMetadata server. To enable JWT Tokens, you will get more details [here](/deployment/security/enable-jwt-tokens).

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

- You can refer to the JWT Troubleshooting section [link](/deployment/security/jwt-troubleshooting) for any issues in your JWT configuration. If you need information on configuring the ingestion with other security providers in your bots, you can follow this doc [link](/deployment/security/workflow-config-auth).

### 2. Prepare the Ingestion DAG

Create a Python file in your Airflow DAGs directory with the following contents:

{% codePreview %}

{% codeInfoContainer %}


{% codeInfo srNumber=11 %}

#### Import necessary modules

The `Workflow` class that is being imported is a part of a metadata ingestion framework, which defines a process of getting data from different sources and ingesting it into a central metadata repository.

Here we are also importing all the basic requirements to parse YAMLs, handle dates and build our DAG.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

**Default arguments for all tasks in the Airflow DAG.** 

- Default arguments dictionary contains default arguments for tasks in the DAG, including the owner's name, email address, number of retries, retry delay, and execution timeout.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

- **config**: Specifies config for the metadata ingestion as we prepare above.

{% /codeInfo %}

{% codeInfo srNumber=14 %}

- **metadata_ingestion_workflow()**: This code defines a function `metadata_ingestion_workflow()` that loads a YAML configuration, creates a `Workflow` object, executes the workflow, checks its status, prints the status to the console, and stops the workflow.

{% /codeInfo %}

{% codeInfo srNumber=15 %}

- **DAG**: creates a DAG using the Airflow framework, and tune the DAG configurations to whatever fits with your requirements
- For more Airflow DAGs creation details visit [here](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html#declaring-a-dag).

{% /codeInfo %}

Note that from connector to connector, this recipe will always be the same.
By updating the `YAML configuration`, you will be able to extract metadata from different sources.

{% /codeInfoContainer %}

{% codeBlock fileName="filename.py" %}

```python {% srNumber=11 %}
import pathlib
import yaml
from datetime import timedelta
from airflow import DAG
from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow
from airflow.utils.dates import days_ago

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator


```

```python {% srNumber=12 %}
default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60)
}


```

```python {% srNumber=13 %}
config = """
<your YAML configuration>
"""


```

```python {% srNumber=14 %}
def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


```

```python {% srNumber=15 %}
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

{% /codeBlock %}

{% /codePreview %}
