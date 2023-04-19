---
title: Run BigQuery Connector using the CLI
slug: /connectors/database/bigquery/cli
---

# Run BigQuery using the metadata CLI

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="check" /%} |
| Data Profiler      | {% icon iconName="check" /%} |
| Data Quality       | {% icon iconName="check" /%} |
| Lineage            | {% icon iconName="check" /%}          |
| DBT                | {% icon iconName="check" /%} |
| Supported Versions | --                           |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | Partially via Views          |
| Table-level  | {% icon iconName="check" /%} |
| Column-level | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the BigQuery connector.

Configure and schedule BigQuery metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](#query-usage)
- [Data Profiler](#data-profiler)
- [Lineage](#lineage)
- [dbt Integration](#dbt-integration)

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

### Python Requirements

To run the BigQuery ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[bigquery]"
```

If you want to run the Usage Connector, you'll also need to install:

```bash
pip3 install "openmetadata-ingestion[bigquery-usage]"
```

### GCP Permissions

To execute metadata extraction and usage workflow successfully the user or the service account should have enough access to fetch required data. Following table describes the minimum required permissions

{% multiTablesWrapper %}

| #    | GCP Permission                | Required For            |
| :--- | :---------------------------- | :---------------------- |
| 1    | bigquery.datasets.get         | Metadata Ingestion      |
| 2    | bigquery.tables.get           | Metadata Ingestion      |
| 3    | bigquery.tables.getData       | Metadata Ingestion      |
| 4    | bigquery.tables.list          | Metadata Ingestion      |
| 5    | resourcemanager.projects.get  | Metadata Ingestion      |
| 6    | bigquery.jobs.create          | Metadata Ingestion      |
| 7    | bigquery.jobs.listAll         | Metadata Ingestion      |
| 8    | datacatalog.taxonomies.get    | Fetch Policy Tags       |
| 9    | datacatalog.taxonomies.list   | Fetch Policy Tags       |
| 10   | bigquery.readsessions.create  | Bigquery Usage & Lineage Workflow |
| 11   | bigquery.readsessions.getData | Bigquery Usage & Lineage Workflow |

{% /multiTablesWrapper %}

{% tilesContainer %}
{% tile
icon="manage_accounts"
title="Create Custom GCP Role"
description="Checkout this documentation on how to create a custom role and assign it to the service account."
link="/connectors/database/bigquery/roles"
  / %}
{% /tilesContainer %}


### 1. Define the YAML Config

This is a sample config for BigQuery:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: This is the BigQuery APIs URL.

**username**: (Optional) Specify the User to connect to BigQuery. It should have enough privileges to read all the metadata.

**projectID**: (Optional) The BigQuery Project ID is required only if the credentials path is being used instead of values.

**credentials**: We support two ways of authenticating to BigQuery inside **gcsConfig:**

**1.** Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:

  - **type**, e.g., `service_account`
  - **projectId**
  - **privateKey**
  - **privateKeyId**
  - **clientEmail**
  - **clientId**
  - **authUri**, https://accounts.google.com/o/oauth2/auth by defaul
  - **tokenUri**, https://oauth2.googleapis.com/token by default
  - **authProviderX509CertUrl**, https://www.googleapis.com/oauth2/v1/certs by default
  - **clientX509CertUrl**

**2.**  Passing a local file path that contains the credentials:
  - **gcsCredentialsPath**



- If you prefer to pass the credentials file, you can do so as follows:
```yaml
credentials:
  gcsConfig: <path to file>
```

**Enable Policy Tag Import (Optional)**: Mark as 'True' to enable importing policy tags from BigQuery to OpenMetadata.

**Classification Name (Optional)**: If the Tag import is enabled, the name of the Classification will be created at OpenMetadata.

**Database (Optional)**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

- If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for BigQuery you can just leave
the GCS credentials empty. This is why they are not marked as required.

```yaml
...
  config:
    type: BigQuery
    credentials:
      gcsConfig: {}
...
```

{% /codeInfo %}

#### Source Configuration - Source Config

{% codeInfo srNumber=4 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json):

**markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.

**includeTables**: true or false, to ingest table data. Default is true.

**includeViews**: true or false, to ingest views definitions.

**databaseFilterPattern**, **schemaFilterPattern**, **tableFilternPattern**: Note that the filter supports regex as include or exclude. You can find examples [here](/connectors/ingestion/workflows/metadata/filter-patterns/database)

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=5 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=6 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

#### Advanced Configuration

{% codeInfo srNumber=2 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
- In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: bigquery
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: BigQuery
```
```yaml {% srNumber=1 %}
      credentials:
        gcsConfig:
          type: My Type
          projectId: project ID # ["project-id-1", "project-id-2"]
          privateKeyId: us-east-2
          privateKey: |
            -----BEGIN PRIVATE KEY-----
            Super secret key
            -----END PRIVATE KEY-----
          clientEmail: client@mail.com
          clientId: 1234
          # authUri: https://accounts.google.com/o/oauth2/auth (default)
          # tokenUri: https://oauth2.googleapis.com/token (default)
          # authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs (default)
          clientX509CertUrl: https://cert.url
```
```yaml {% srNumber=2 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=3 %}
      # connectionArguments:
      #   key: value
```

```yaml {% srNumber=4 %}
      sourceConfig:
        config:
          type: DatabaseMetadata
          markDeletedTables: true
          includeTables: true
          includeViews: true
          # includeTags: true
          # databaseFilterPattern:
          #   includes:
          #     - database1
          #     - database2
          #   excludes:
          #     - database3
          #     - database4
          # schemaFilterPattern:
          #   includes:
          #     - schema1
          #     - schema2
          #   excludes:
          #     - schema3
          #     - schema4
          # tableFilterPattern:
          #   includes:
          #     - users
          #     - type_test
          #   excludes:
          #     - table3
          #     - table4
```

```yaml {% srNumber=5 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=6 %}
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

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.


## Query Usage

The Query Usage workflow will be using the `query-parser` processor.

After running a Metadata Ingestion workflow, we can run Query Usage workflow.
While the `serviceName` will be the same to that was used in Metadata Ingestion, so the ingestion bot can get the `serviceConnection` details from the server.


### 1. Define the YAML Config

This is a sample config for BigQuery Usage:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=7 %}

#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryUsagePipeline.json).

**queryLogDuration**: Configuration to tune how far we want to look back in query logs to process usage data.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**stageFileLocation**: Temporary file name to store the query logs before processing. Absolute file path required.

{% /codeInfo %}

{% codeInfo srNumber=9 %}

**resultLimit**: Configuration to set the limit for query logs

{% /codeInfo %}

{% codeInfo srNumber=10 %}

**queryLogFilePath**: Configuration to set the file path for query logs

{% /codeInfo %}


{% codeInfo srNumber=11 %}

#### Processor, Stage and Bulk Sink Configuration

To specify where the staging files will be located.

Note that the location is a directory that will be cleaned at the end of the ingestion.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: bigquery-usage
  serviceName: <service name>
  sourceConfig:
    config:
      type: DatabaseUsage
```
```yaml {% srNumber=7 %}
      # Number of days to look back
      queryLogDuration: 7
```

```yaml {% srNumber=8 %}
      # This is a directory that will be DELETED after the usage runs
      stageFileLocation: <path to store the stage file>
```

```yaml {% srNumber=9 %}
      # resultLimit: 1000
```

```yaml {% srNumber=10 %}
      # If instead of getting the query logs from the database we want to pass a file with the queries
      # queryLogFilePath: path-to-file
```

```yaml {% srNumber=11 %}
processor:
  type: query-parser
  config: {}
stage:
  type: table-usage
  config:
    filename: /tmp/bigquery_usage
bulkSink:
  type: metadata-usage
  config:
    filename: /tmp/bigquery_usage
```

```yaml {% srNumber=12 %}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

{% /codeBlock %}
{% /codePreview %}

### 2. Run with the CLI

There is an extra requirement to run the Usage pipelines. You will need to install:

```bash
pip3 install --upgrade 'openmetadata-ingestion[bigquery-usage]'
```

After saving the YAML config, we will run the command the same way we did for the metadata ingestion:

```bash
metadata ingest -c <path-to-yaml>
```

## Data Profiler

The Data Profiler workflow will be using the `orm-profiler` processor.

After running a Metadata Ingestion workflow, we can run Data Profiler workflow.
While the `serviceName` will be the same to that was used in Metadata Ingestion, so the ingestion bot can get the `serviceConnection` details from the server.


### 1. Define the YAML Config

This is a sample config for the profiler:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=13 %}
#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json).

**generateSampleData**: Option to turn on/off generating sample data.

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**profileSample**: Percentage of data or no. of rows we want to execute the profiler and tests on.

{% /codeInfo %}

{% codeInfo srNumber=15 %}

**threadCount**: Number of threads to use during metric computations.

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**processPiiSensitive**: Optional configuration to automatically tag columns that might contain sensitive information.

{% /codeInfo %}

{% codeInfo srNumber=17 %}

**confidence**: Set the Confidence value for which you want the column to be marked

{% /codeInfo %}


{% codeInfo srNumber=18 %}

**timeoutSeconds**: Profiler Timeout in Seconds

{% /codeInfo %}

{% codeInfo srNumber=19 %}

**databaseFilterPattern**: Regex to only fetch databases that matches the pattern.

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
  type: bigquery
  serviceName: local_bigquery
  sourceConfig:
    config:
      type: Profiler
```

```yaml {% srNumber=13 %}
      generateSampleData: true
```
```yaml {% srNumber=14 %}
      # profileSample: 85
```
```yaml {% srNumber=15 %}
      # threadCount: 5
```
```yaml {% srNumber=16 %}
      processPiiSensitive: false
```
```yaml {% srNumber=17 %}
      # confidence: 80
```
```yaml {% srNumber=18 %}
      # timeoutSeconds: 43200
```
```yaml {% srNumber=19 %}
      # databaseFilterPattern:
      #   includes:
      #     - database1
      #     - database2
      #   excludes:
      #     - database3
      #     - database4
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
    #     profileSample: <number between 0 and 99> # default 

    #     profileSample: <number between 0 and 99> # default will be 100 if omitted
    #     profileQuery: <query to use for sampling data for the profiler>
    #     columnConfig:
    #       excludeColumns:
    #         - <column name>
    #       includeColumns:
    #         - columnName: <column name>
    #         - metrics:
    #           - MEAN
    #           - MEDIAN
    #           - ...
    #     partitionConfig:
    #       enablePartitioning: <set to true to use partitioning>
    #       partitionColumnName: <partition column name. Must be a timestamp or datetime/date field type>
    #       partitionInterval: <partition interval>
    #       partitionIntervalUnit: <YEAR, MONTH, DAY, HOUR>

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
from metadata.orm_profiler.api.workflow import ProfilerWorkflow

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

## Lineage

You can learn more about how to ingest lineage [here](/connectors/ingestion/workflows/lineage).

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
