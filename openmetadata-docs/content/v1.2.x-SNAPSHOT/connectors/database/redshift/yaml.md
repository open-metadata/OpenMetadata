---
title: Run the Redshift Connector Externally
slug: /connectors/database/redshift/yaml
---

# Run the Redshift Connector Externally

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="check" /%} |
| Data Profiler      | {% icon iconName="check" /%} |
| Data Quality       | {% icon iconName="check" /%} |
| Lineage            | {% icon iconName="check" /%} |
| DBT                | {% icon iconName="check" /%} |
| Supported Versions | --                           |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | {% icon iconName="check" /%} |
| Table-level  | {% icon iconName="check" /%} |
| Column-level | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the Redshift connector.

Configure and schedule Redshift metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](#query-usage)
- [Data Profiler](#data-profiler)
- [Lineage](#lineage)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}



Redshift user must grant `SELECT` privilege on table [SVV_TABLE_INFO](https://docs.aws.amazon.com/redshift/latest/dg/r_SVV_TABLE_INFO.html) to fetch the metadata of tables and views. For more information visit [here](https://docs.aws.amazon.com/redshift/latest/dg/c_visibility-of-data.html).

```sql

CREATE USER test_user with PASSWORD 'password';
GRANT SELECT ON TABLE svv_table_info to test_user;

```

### Python Requirements

To run the Redshift ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[redshift]"
```

If you want to run the Usage Connector, you'll also need to install:

```bash
pip3 install "openmetadata-ingestion[redshift-usage]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/redshiftConnection.json)
you can find the structure to create a connection to Redshift.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)


**Note:** During the metadata ingestion for redshift, the tables in which the distribution style i.e `DISTSTYLE` is not `AUTO` will be marked as partitioned tables


### 1. Define the YAML Config

This is a sample config for Redshift:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Snoflake. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Redshift.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**hostPort**: Host and port of the Redshift service.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**ingestAllDatabases**: Ingest data from all databases in Redshift. You can use databaseFilterPattern on top of this.

{% /codeInfo %}



#### Source Configuration - Source Config

{% codeInfo srNumber=8 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json):

**markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.

**includeTables**: true or false, to ingest table data. Default is true.

**includeViews**: true or false, to ingest views definitions.

**databaseFilterPattern**, **schemaFilterPattern**, **tableFilterPattern**: Note that the filter supports regex as include or exclude. You can find examples [here](/connectors/ingestion/workflows/metadata/filter-patterns/database)

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=9 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.2/connectors/workflow-config.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=6 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: redshift
  serviceName: aws_redshift
  serviceConnection:
    config:
      type: Redshift
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      password: password
```
```yaml {% srNumber=3 %}
      database: dev
```
```yaml {% srNumber=4 %}
      hostPort: cluster.name.region.redshift.amazonaws.com:5439
```
```yaml {% srNumber=5 %}
      # ingestAllDatabases: true
```
```yaml {% srNumber=6 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=7 %}
      # connectionArguments:
      #   key: value
```

```yaml {% srNumber=8 %}
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

```yaml {% srNumber=9 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.2/connectors/workflow-config-yaml.md" /%}

{% /codeBlock %}

{% /codePreview %}

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

This is a sample config for Redshift Usage:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=11 %}

#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryUsagePipeline.json).

**queryLogDuration**: Configuration to tune how far we want to look back in query logs to process usage data.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

**stageFileLocation**: Temporary file name to store the query logs before processing. Absolute file path required.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

**resultLimit**: Configuration to set the limit for query logs

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**queryLogFilePath**: Configuration to set the file path for query logs

{% /codeInfo %}


{% codeInfo srNumber=15 %}

#### Processor, Stage and Bulk Sink Configuration

To specify where the staging files will be located.

Note that the location is a directory that will be cleaned at the end of the ingestion.

{% /codeInfo %}

{% codeInfo srNumber=16 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: redshift-usage
  serviceName: <service name>
  sourceConfig:
    config:
      type: DatabaseUsage
```
```yaml {% srNumber=11 %}
      # Number of days to look back
      queryLogDuration: 7
```

```yaml {% srNumber=12 %}
      # This is a directory that will be DELETED after the usage runs
      stageFileLocation: <path to store the stage file>
```

```yaml {% srNumber=13 %}
      # resultLimit: 1000
```

```yaml {% srNumber=14 %}
      # If instead of getting the query logs from the database we want to pass a file with the queries
      # queryLogFilePath: path-to-file
```

```yaml {% srNumber=15 %}
processor:
  type: query-parser
  config: {}
stage:
  type: table-usage
  config:
    filename: /tmp/redshift_usage
bulkSink:
  type: metadata-usage
  config:
    filename: /tmp/redshift_usage
```

```yaml {% srNumber=16 %}
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
pip3 install --upgrade 'openmetadata-ingestion[redshift-usage]'
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

{% codeInfo srNumber=17 %}
#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json).

**generateSampleData**: Option to turn on/off generating sample data.

{% /codeInfo %}

{% codeInfo srNumber=18 %}

**profileSample**: Percentage of data or no. of rows we want to execute the profiler and tests on.

{% /codeInfo %}

{% codeInfo srNumber=19 %}

**threadCount**: Number of threads to use during metric computations.

{% /codeInfo %}

{% codeInfo srNumber=20 %}

**processPiiSensitive**: Optional configuration to automatically tag columns that might contain sensitive information.

{% /codeInfo %}

{% codeInfo srNumber=21 %}

**confidence**: Set the Confidence value for which you want the column to be marked

{% /codeInfo %}


{% codeInfo srNumber=22 %}

**timeoutSeconds**: Profiler Timeout in Seconds

{% /codeInfo %}

{% codeInfo srNumber=23 %}

**databaseFilterPattern**: Regex to only fetch databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=24 %}

**schemaFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=25 %}

**tableFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=26 %}

#### Processor Configuration

Choose the `orm-profiler`. Its config can also be updated to define tests from the YAML itself instead of the UI:

**tableConfig**: `tableConfig` allows you to set up some configuration at the table level.
{% /codeInfo %}


{% codeInfo srNumber=27 %}

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.
{% /codeInfo %}


{% codeInfo srNumber=28 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: redshift
  serviceName: local_redshift
  sourceConfig:
    config:
      type: Profiler
```

```yaml {% srNumber=17 %}
      generateSampleData: true
```
```yaml {% srNumber=18 %}
      # profileSample: 85
```
```yaml {% srNumber=19 %}
      # threadCount: 5
```
```yaml {% srNumber=20 %}
      processPiiSensitive: false
```
```yaml {% srNumber=21 %}
      # confidence: 80
```
```yaml {% srNumber=22 %}
      # timeoutSeconds: 43200
```
```yaml {% srNumber=23 %}
      # databaseFilterPattern:
      #   includes:
      #     - database1
      #     - database2
      #   excludes:
      #     - database3
      #     - database4
```
```yaml {% srNumber=24 %}
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
```
```yaml {% srNumber=25 %}
      # tableFilterPattern:
      #   includes:
      #     - table1
      #     - table2
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=26 %}
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

```yaml {% srNumber=27 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=28 %}
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

{% codeInfo srNumber=29 %}

#### Import necessary modules

The `ProfilerWorkflow` class that is being imported is a part of a metadata orm_profiler framework, which defines a process of extracting Profiler data. 

Here we are also importing all the basic requirements to parse YAMLs, handle dates and build our DAG.

{% /codeInfo %}

{% codeInfo srNumber=30 %}

**Default arguments for all tasks in the Airflow DAG.** 
- Default arguments dictionary contains default arguments for tasks in the DAG, including the owner's name, email address, number of retries, retry delay, and execution timeout.

{% /codeInfo %}


{% codeInfo srNumber=31 %}

- **config**: Specifies config for the profiler as we prepare above.

{% /codeInfo %}

{% codeInfo srNumber=32 %}

- **metadata_ingestion_workflow()**: This code defines a function `metadata_ingestion_workflow()` that loads a YAML configuration, creates a `ProfilerWorkflow` object, executes the workflow, checks its status, prints the status to the console, and stops the workflow.

{% /codeInfo %}

{% codeInfo srNumber=33 %}

- **DAG**: creates a DAG using the Airflow framework, and tune the DAG configurations to whatever fits with your requirements
- For more Airflow DAGs creation details visit [here](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html#declaring-a-dag).

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.py" %}

```python {% srNumber=29 %}
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
```python {% srNumber=30 %}
default_args = {
   "owner": "user_name",
   "email_on_failure": False,
   "retries": 3,
   "retry_delay": timedelta(seconds=10),
   "execution_timeout": timedelta(minutes=60),
}


```

```python {% srNumber=31 %}
config = """
<your YAML configuration>
"""


```

```python {% srNumber=32 %}
def metadata_ingestion_workflow():
   workflow_config = yaml.safe_load(config)
   workflow = ProfilerWorkflow.create(workflow_config)
   workflow.execute()
   workflow.raise_from_status()
   workflow.print_status()
   workflow.stop()


```

```python {% srNumber=33 %}
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


## SSL Configuration

In order to integrate SSL in the Metadata Ingestion Config, the user will have to add the SSL config under connectionArguments which is placed in the source.

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=34 %}

### SSL Modes

There are couple of types of SSL modes that Redshift supports which can be added to ConnectionArguments, they are as follows:
- **disable**: SSL is disabled and the connection is not encrypted.

- **allow**: SSL is used if the server requires it.

- **prefer**: SSL is used if the server supports it. Amazon Redshift supports SSL, so SSL is used when you set sslmode to prefer.

- **require**: SSL is required.

- **verify-ca**: SSL must be used and the server certificate must be verified.

- **verify-full**: SSL must be used. The server certificate must be verified and the server hostname must match the hostname attribute on the certificate.

For more information, you can visit [Redshift SSL documentation](https://docs.aws.amazon.com/redshift/latest/mgmt/connecting-ssl-support.html)

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% srNumber=34 %}
source:
  type: redshift
  serviceName: <service name>
  serviceConnection:
    config:
      type: Redshift
      hostPort: cluster.name.region.redshift.amazonaws.com:5439
      username: username
      ...
      ...
      ...
      connectionArguments:
        sslmode: <ssl-mode>




```
{% /codeBlock %}
{% /codePreview %}



## Lineage

You can learn more about how to ingest lineage [here](/connectors/ingestion/workflows/lineage).

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).



