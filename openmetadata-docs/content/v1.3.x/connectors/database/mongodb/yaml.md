---
title: Run the MongoDB Connector Externally
slug: /connectors/database/mongodb/yaml
---

{% connectorDetailsHeader
name="MongoDB"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler",]
unavailableFeatures=["Query Usage", "Data Quality", "dbt", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the MongoDB connector.

Configure and schedule MongoDB metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/mongodb/yaml"} /%}

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

To fetch the metadata from MongoDB to OpenMetadata, the MongoDB user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.

### Python Requirements

To run the MongoDB ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[mongo]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/mongoDBConnection.json)
you can find the structure to create a connection to MongoDB.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for MongoDB:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Username to connect to Mongodb. This user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to MongoDB.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: The hostPort parameter specifies the host and port of the MongoDB. This should be specified as a string in the format `hostname:port`. E.g., `localhost:27017`.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=7 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}


{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: mongodb
  serviceName: local_mongodb
  serviceConnection:
    config:
      type: MongoDB
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      password: password
```
```yaml {% srNumber=3 %}
      hostPort: localhost:27017
```
```yaml {% srNumber=7 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=6 %}
      database: custom_database_name
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

## Data Profiler

The Data Profiler workflow will be using the `orm-profiler` processor.

After running a Metadata Ingestion workflow, we can run Data Profiler workflow.
While the `serviceName` will be the same to that was used in Metadata Ingestion, so the ingestion bot can get the `serviceConnection` details from the server.

### Limitations

The MongodDB data profiler current supports only the following features:

1. **Row count**: The number of rows in the collection. Sampling or custom query is not supported.
2. **Sample data:** If a custom query is defined it will be used for sample data.

### 1. Define the YAML Config

This is a sample config for the profiler:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=13 %}

#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json).

**generateSampleData**: Option to turn on/off generating sample data.

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**processPiiSensitive**: Optional configuration to automatically tag columns that might contain sensitive information.

{% /codeInfo %}

{% codeInfo srNumber=18 %}

**timeoutSeconds**: Profiler Timeout in Seconds

{% /codeInfo %}

{% codeInfo srNumber=20 %}

**schemaFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=21 %}

**tableFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=22 %}

#### Processor Configuration

Choose the `orm-profiler`. Its config can also be updated to define tests from the YAML itself instead of the UI:

**tableConfig**: `tableConfig` allows you to set up some configuration at the table level.
{% /codeInfo %}

{% codeInfo srNumber=23 %}

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.
{% /codeInfo %}


{% codeInfo srNumber=24 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: monogodb
  serviceName: local_mongodb
  sourceConfig:
    config:
      type: Profiler
```

```yaml {% srNumber=13 %}
      generateSampleData: true
```
```yaml {% srNumber=16 %}
      processPiiSensitive: false
```
```yaml {% srNumber=18 %}
      # timeoutSeconds: 43200
```
```yaml {% srNumber=20 %}
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
```
```yaml {% srNumber=21 %}
      # tableFilterPattern:
      #   includes:
      #     - table1
      #     - table2
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=22 %}
processor:
  type: orm-profiler
  config: {}  # Remove braces if adding properties
    # tableConfig:
    #   - fullyQualifiedName: <table fqn>
    #     profileQuery: <query to use for fetching the sample data>
```

```yaml {% srNumber=23 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=24 %}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

{% /codeBlock %}

{% /codePreview %}

- You can learn more about how to configure and run the Profiler Workflow to extract Profiler data and execute the Data Quality from [here](/connectors/ingestion/workflows/profiler)



### 2. Prepare the Profiler DAG

Here, we follow a similar approach as with the metadata and usage pipelines, although we will use a different Workflow class:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=25 %}

#### Import necessary modules

The `ProfilerWorkflow` class that is being imported is a part of a metadata orm_profiler framework, which defines a process of extracting Profiler data. 

Here we are also importing all the basic requirements to parse YAMLs, handle dates and build our DAG.

{% /codeInfo %}

{% codeInfo srNumber=26 %}

**Default arguments for all tasks in the Airflow DAG.** 
- Default arguments dictionary contains default arguments for tasks in the DAG, including the owner's name, email address, number of retries, retry delay, and execution timeout.

{% /codeInfo %}


{% codeInfo srNumber=27 %}

- **config**: Specifies config for the profiler as we prepare above.

{% /codeInfo %}

{% codeInfo srNumber=28 %}

- **metadata_ingestion_workflow()**: This code defines a function `metadata_ingestion_workflow()` that loads a YAML configuration, creates a `ProfilerWorkflow` object, executes the workflow, checks its status, prints the status to the console, and stops the workflow.

{% /codeInfo %}

{% codeInfo srNumber=29 %}

- **DAG**: creates a DAG using the Airflow framework, and tune the DAG configurations to whatever fits with your requirements
- For more Airflow DAGs creation details visit [here](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html#declaring-a-dag).

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.py" %}

```python {% srNumber=26 %}
import yaml
from datetime import timedelta
from airflow import DAG
from metadata.profiler.api.workflow import ProfilerWorkflow

try:
   from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
   from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago


```
```python {% srNumber=27 %}
default_args = {
   "owner": "user_name",
   "email_on_failure": False,
   "retries": 3,
   "retry_delay": timedelta(seconds=10),
   "execution_timeout": timedelta(minutes=60),
}


```

```python {% srNumber=28 %}
config = """
<your YAML configuration>
"""


```

```python {% srNumber=29 %}
def metadata_ingestion_workflow():
   workflow_config = yaml.safe_load(config)
   workflow = ProfilerWorkflow.create(workflow_config)
   workflow.execute()
   workflow.raise_from_status()
   workflow.print_status()
   workflow.stop()


```

```python {% srNumber=30 %}
with DAG(
   "profiler_example",
   default_args=default_args,
   description="An example DAG which runs a OpenMetadata ingestion workflow",
   start_date=days_ago(1),
   is_paused_upon_creation=False,
   catchup=False,
) as dag:
   ingest_task = PythonOperator(
       task_id="profile_and_test_using_recipe",
       python_callable=metadata_ingestion_workflow,
   )


```

{% /codeBlock %}

{% /codePreview %}

## dbt Integration

{% tilesContainer %}

{% tile
icon="mediation"
title="dbt Integration"
description="Learn more about how to ingest dbt models' definitions and their lineage."
link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}

