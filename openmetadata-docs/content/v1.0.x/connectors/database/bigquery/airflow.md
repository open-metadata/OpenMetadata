---
title: Run BigQuery Connector using Airflow SDK
slug: /connectors/database/bigquery/airflow
---

# Run BigQuery using the Airflow SDK 

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
| Lineage      | {% icon iconName="check" /%} |
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


## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/bigQueryConnection.json)
you can find the structure to create a connection to BigQuery.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for BigQuery:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: BigQuery APIs URL. By default the API URL is `bigquery.googleapis.com` you can modify this if you have custom implementation of BigQuery.

**credentials**: 
You can authenticate with your bigquery instance using either `GCS Credentials Path` where you can specify the file path of the service account key or you can pass the values directly by choosing the `GCS Credentials Values` from the service account key file.

You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.



**gcsConfig:**

**1.** Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:

  - **type**: Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
  - **projectId**: A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file. You can also pass multiple project id to ingest metadata from different BigQuery projects into one service.
  - **privateKeyId**: This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
  - **privateKey**: This is the private key associated with the service account that is used to authenticate and authorize access to BigQuery. To fetch this key, look for the value associated with the `private_key` key in the service account file.
  - **clientEmail**: This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
  - **clientId**: This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key  file.
  - **authUri**: This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file. The default value to Auth URI is https://accounts.google.com/o/oauth2/auth.
  - **tokenUri**: The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization. To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file. Default Value to Token URI is https://oauth2.googleapis.com/token.
  - **authProviderX509CertUrl**: This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file. The Default value for Auth Provider X509Cert URL is https://www.googleapis.com/oauth2/v1/certs
  - **clientX509CertUrl**: This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key  file.

**2.**  Passing a local file path that contains the credentials:
  - **gcsCredentialsPath**



- If you prefer to pass the credentials file, you can do so as follows:
```yaml
credentials:
  gcsConfig: <path to file>
```

**Classification Name (Optional)**: If the Tag import is enabled, the name of the Classification will be created at OpenMetadata.

**Taxonomy Project ID (Optional)**: Bigquery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how yo can create policy tags and set up column-level access control [here](https://cloud.google.com/bigquery/docs/column-level-security)

If you have attached policy tags to the columns of table available in Bigquery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the id of project in which the taxonomy was created.

**Taxonomy Location (Optional)**: Bigquery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how yo can create policy tags and set up column-level access control [here](https://cloud.google.com/bigquery/docs/column-level-security)

If you have attached policy tags to the columns of table available in Bigquery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the location/region in which the taxonomy was created.

**Usage Location (Optional)**:
Location used to query `INFORMATION_SCHEMA.JOBS_BY_PROJECT` to fetch usage data. You can pass multi-regions, such as `us` or `eu`, or your specific region such as `us-east1`. Australia and Asia multi-regions are not yet supported.

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

**databaseFilterPattern**, **schemaFilterPattern**, **tableFilterPattern**: Note that the filter supports regex as include or exclude. You can find examples [here](/connectors/ingestion/workflows/metadata/filter-patterns/database)

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

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: bigquery
  serviceName: <service name>
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
          # taxonomyLocation: us
          # taxonomyProjectID: ["project-id-1", "project-id-2"]
          # usageLocation: us
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


### 2. Prepare the Ingestion DAG

Create a Python file in your Airflow DAGs directory with the following contents:

{% codePreview %}

{% codeInfoContainer %}


{% codeInfo srNumber=7 %}

#### Import necessary modules

The `Workflow` class that is being imported is a part of a metadata ingestion framework, which defines a process of getting data from different sources and ingesting it into a central metadata repository.

Here we are also importing all the basic requirements to parse YAMLs, handle dates and build our DAG.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**Default arguments for all tasks in the Airflow DAG.** 

- Default arguments dictionary contains default arguments for tasks in the DAG, including the owner's name, email address, number of retries, retry delay, and execution timeout.

{% /codeInfo %}

{% codeInfo srNumber=9 %}

- **config**: Specifies config for the metadata ingestion as we prepare above.

{% /codeInfo %}

{% codeInfo srNumber=10 %}

- **metadata_ingestion_workflow()**: This code defines a function `metadata_ingestion_workflow()` that loads a YAML configuration, creates a `Workflow` object, executes the workflow, checks its status, prints the status to the console, and stops the workflow.

{% /codeInfo %}

{% codeInfo srNumber=11 %}

- **DAG**: creates a DAG using the Airflow framework, and tune the DAG configurations to whatever fits with your requirements
- For more Airflow DAGs creation details visit [here](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html#declaring-a-dag).

{% /codeInfo %}

Note that from connector to connector, this recipe will always be the same.
By updating the `YAML configuration`, you will be able to extract metadata from different sources.

{% /codeInfoContainer %}

{% codeBlock fileName="filename.py" %}

```python {% srNumber=7 %}
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

```python {% srNumber=8 %}
default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60)
}


```

```python {% srNumber=9 %}
config = """
<your YAML configuration>
"""


```

```python {% srNumber=10 %}
def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


```

```python {% srNumber=11 %}
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

## Query Usage

The Query Usage workflow will be using the `query-parser` processor.

After running a Metadata Ingestion workflow, we can run Query Usage workflow.
While the `serviceName` will be the same to that was used in Metadata Ingestion, so the ingestion bot can get the `serviceConnection` details from the server.


### 1. Define the YAML Config

This is a sample config for BigQuery Usage:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=12 %}

#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryUsagePipeline.json).

**queryLogDuration**: Configuration to tune how far we want to look back in query logs to process usage data.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

**stageFileLocation**: Temporary file name to store the query logs before processing. Absolute file path required.

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**resultLimit**: Configuration to set the limit for query logs

{% /codeInfo %}

{% codeInfo srNumber=15 %}

**queryLogFilePath**: Configuration to set the file path for query logs

{% /codeInfo %}


{% codeInfo srNumber=16 %}

#### Processor, Stage and Bulk Sink Configuration

To specify where the staging files will be located.

Note that the location is a directory that will be cleaned at the end of the ingestion.

{% /codeInfo %}

{% codeInfo srNumber=17 %}

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
```yaml {% srNumber=12 %}
      # Number of days to look back
      queryLogDuration: 7
```

```yaml {% srNumber=13 %}
      # This is a directory that will be DELETED after the usage runs
      stageFileLocation: <path to store the stage file>
```

```yaml {% srNumber=14 %}
      # resultLimit: 1000
```

```yaml {% srNumber=15 %}
      # If instead of getting the query logs from the database we want to pass a file with the queries
      # queryLogFilePath: path-to-file
```

```yaml {% srNumber=16 %}
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

```yaml {% srNumber=17 %}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

{% /codeBlock %}
{% /codePreview %}

### 2. Prepare the Usage DAG

For the usage workflow creation, the Airflow file will look the same as for the metadata ingestion. Updating the YAML configuration will be enough.


## Data Profiler

The Data Profiler workflow will be using the `orm-profiler` processor.

After running a Metadata Ingestion workflow, we can run Data Profiler workflow.
While the `serviceName` will be the same to that was used in Metadata Ingestion, so the ingestion bot can get the `serviceConnection` details from the server.


### 1. Define the YAML Config

This is a sample config for the profiler:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=18 %}
#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json).

**generateSampleData**: Option to turn on/off generating sample data.

{% /codeInfo %}

{% codeInfo srNumber=19 %}

**profileSample**: Percentage of data or no. of rows we want to execute the profiler and tests on.

{% /codeInfo %}

{% codeInfo srNumber=20 %}

**threadCount**: Number of threads to use during metric computations.

{% /codeInfo %}

{% codeInfo srNumber=21 %}

**processPiiSensitive**: Optional configuration to automatically tag columns that might contain sensitive information.

{% /codeInfo %}

{% codeInfo srNumber=22 %}

**confidence**: Set the Confidence value for which you want the column to be marked

{% /codeInfo %}


{% codeInfo srNumber=23 %}

**timeoutSeconds**: Profiler Timeout in Seconds

{% /codeInfo %}

{% codeInfo srNumber=24 %}

**databaseFilterPattern**: Regex to only fetch databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=25 %}

**schemaFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=26 %}

**tableFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=27 %}

#### Processor Configuration

Choose the `orm-profiler`. Its config can also be updated to define tests from the YAML itself instead of the UI:

**tableConfig**: `tableConfig` allows you to set up some configuration at the table level.
{% /codeInfo %}


{% codeInfo srNumber=28 %}

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.
{% /codeInfo %}


{% codeInfo srNumber=29 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: bigquery
  serviceName: <service name>
  sourceConfig:
    config:
      type: Profiler
```

```yaml {% srNumber=18 %}
      generateSampleData: true
```
```yaml {% srNumber=19 %}
      # profileSample: 85
```
```yaml {% srNumber=20 %}
      # threadCount: 5
```
```yaml {% srNumber=21 %}
      processPiiSensitive: false
```
```yaml {% srNumber=22 %}
      # confidence: 80
```
```yaml {% srNumber=23 %}
      # timeoutSeconds: 43200
```
```yaml {% srNumber=24 %}
      # databaseFilterPattern:
      #   includes:
      #     - database1
      #     - database2
      #   excludes:
      #     - database3
      #     - database4
```
```yaml {% srNumber=25 %}
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
```
```yaml {% srNumber=26 %}
      # tableFilterPattern:
      #   includes:
      #     - table1
      #     - table2
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=27 %}
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

```yaml {% srNumber=28 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=29 %}
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

{% codeInfo srNumber=30 %}

#### Import necessary modules

The `ProfilerWorkflow` class that is being imported is a part of a metadata orm_profiler framework, which defines a process of extracting Profiler data. 

Here we are also importing all the basic requirements to parse YAMLs, handle dates and build our DAG.

{% /codeInfo %}

{% codeInfo srNumber=31 %}

**Default arguments for all tasks in the Airflow DAG.** 
- Default arguments dictionary contains default arguments for tasks in the DAG, including the owner's name, email address, number of retries, retry delay, and execution timeout.

{% /codeInfo %}


{% codeInfo srNumber=32 %}

- **config**: Specifies config for the profiler as we prepare above.

{% /codeInfo %}

{% codeInfo srNumber=33 %}

- **metadata_ingestion_workflow()**: This code defines a function `metadata_ingestion_workflow()` that loads a YAML configuration, creates a `ProfilerWorkflow` object, executes the workflow, checks its status, prints the status to the console, and stops the workflow.

{% /codeInfo %}

{% codeInfo srNumber=34 %}

- **DAG**: creates a DAG using the Airflow framework, and tune the DAG configurations to whatever fits with your requirements
- For more Airflow DAGs creation details visit [here](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html#declaring-a-dag).

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.py" %}

```python {% srNumber=30 %}
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
```python {% srNumber=31 %}
default_args = {
   "owner": "user_name",
   "email_on_failure": False,
   "retries": 3,
   "retry_delay": timedelta(seconds=10),
   "execution_timeout": timedelta(minutes=60),
}


```

```python {% srNumber=32 %}
config = """
<your YAML configuration>
"""


```

```python {% srNumber=33 %}
def metadata_ingestion_workflow():
   workflow_config = yaml.safe_load(config)
   workflow = ProfilerWorkflow.create(workflow_config)
   workflow.execute()
   workflow.raise_from_status()
   workflow.print_status()
   workflow.stop()


```

```python {% srNumber=34 %}
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
