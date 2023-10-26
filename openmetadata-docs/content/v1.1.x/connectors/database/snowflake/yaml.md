---
title: Run the Snowflake Connector Externally
slug: /connectors/database/snowflake/yaml
---

# Run the Snowflake Connector Externally

{% multiTablesWrapper %}

| Feature            | Status                       |
|:-------------------|:-----------------------------|
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="check" /%} |
| Data Profiler      | {% icon iconName="check" /%} |
| Data Quality       | {% icon iconName="check" /%} |
| Lineage            | {% icon iconName="check" /%} |
| DBT                | {% icon iconName="check" /%} |
| Supported Versions | --                           |

| Feature      | Status                       |
|:-------------|:-----------------------------|
| Lineage      | {% icon iconName="check" /%} |
| Table-level  | {% icon iconName="check" /%} |
| Column-level | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the Snowflake connector.

Configure and schedule Snowflake metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](#query-usage)
- [Data Profiler](#data-profiler)
- [Lineage](#lineage)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.1/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}



### Python Requirements

To run the Snowflake ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[snowflake]"
```

If you want to run the Usage Connector, you'll also need to install:

```bash
pip3 install "openmetadata-ingestion[snowflake-usage]"
```
To ingest basic metadata snowflake user must have the following privileges:
  - `USAGE` Privilege on Warehouse
  - `USAGE` Privilege on Database
  - `USAGE` Privilege on Schema
  - `SELECT` Privilege on Tables
```sql
-- Create New Role
CREATE ROLE NEW_ROLE;

-- Create New User
CREATE USER NEW_USER DEFAULT_ROLE=NEW_ROLE PASSWORD='PASSWORD';

-- Grant role to user
GRANT ROLE NEW_ROLE TO USER NEW_USER;

-- Grant USAGE Privilege on Warehouse to New Role
GRANT USAGE ON WAREHOUSE WAREHOUSE_NAME TO ROLE NEW_ROLE;

-- Grant USAGE Privilege on Database to New Role
GRANT USAGE ON DATABASE TEST_DB TO ROLE NEW_ROLE;

-- Grant USAGE Privilege on required Schemas to New Role
GRANT USAGE ON SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;

-- Grant SELECT Privilege on required tables & views to New Role
GRANT SELECT ON ALL TABLES IN SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;
GRANT SELECT ON ALL EXTERNAL TABLES IN SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;
GRANT SELECT ON ALL VIEWS IN SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;
```


While running the usage workflow, Openmetadata fetches the query logs by querying `snowflake.account_usage.query_history` table. For this the snowflake user should be granted the `ACCOUNTADMIN` role or a role granted IMPORTED PRIVILEGES on the database `SNOWFLAKE`.

```sql

-- Grant IMPORTED PRIVILEGES on all Schemas of SNOWFLAKE DB to New Role
GRANT IMPORTED PRIVILEGES ON ALL SCHEMAS IN DATABASE SNOWFLAKE TO ROLE NEW_ROLE;

```


If ingesting tags, the user should also have permissions to query `snowflake.account_usage.tag_references`.For this the snowflake user should be granted the `ACCOUNTADMIN` role or a role granted IMPORTED PRIVILEGES on the database

```sql

-- Grant IMPORTED PRIVILEGES on all Schemas of SNOWFLAKE DB to New Role
GRANT IMPORTED PRIVILEGES ON ALL SCHEMAS IN DATABASE SNOWFLAKE TO ROLE NEW_ROLE;

```

You can find more information about the `account_usage` schema [here](https://docs.snowflake.com/en/sql-reference/account-usage).

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json)
you can find the structure to create a connection to Snowflake.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Snowflake:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Snowflake. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Snowflake.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**warehouse**: Snowflake warehouse is required for executing queries to fetch the metadata. Enter the name of warehouse against which you would like to execute these queries.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**account**: Snowflake account identifier uniquely identifies a Snowflake account within your organization, as well as throughout the global network of Snowflake-supported cloud platforms and cloud regions. If the Snowflake URL is `https://xyz1234.us-east-1.gcp.snowflakecomputing.com`, then the account is `xyz1234.us-east-1.gcp`.


{% /codeInfo %}

{% codeInfo srNumber=5 %}

**database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**includeTempTables**: Optional configuration for ingestion of TRANSIENT and TEMPORARY tables, By default, it will skip the TRANSIENT and TEMPORARY tables.

{% /codeInfo %}

{% codeInfo srNumber=39 %}

**clientSessionKeepAlive**: Optional Configuration to keep the session active in case the ingestion job runs for longer duration. 

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**privateKey**: If you have configured the key pair authentication for the given user you will have to pass the private key associated with the user in this field. You can checkout [this](https://docs.snowflake.com/en/user-guide/key-pair-auth) doc to get more details about key-pair authentication.
  - The multi-line key needs to be converted to one line with `\n` for line endings i.e. `-----BEGIN ENCRYPTED PRIVATE KEY-----\nMII...\n...\n-----END ENCRYPTED PRIVATE KEY-----`

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**snowflakePrivatekeyPassphrase**: If you have configured the encrypted key pair authentication for the given user you will have to pass the paraphrase associated with the private key in this field. You can checkout [this](https://docs.snowflake.com/en/user-guide/key-pair-auth) doc to get more details about key-pair authentication.


{% /codeInfo %}

{% codeInfo srNumber=9 %}

**role**: You can specify the role of user that you would like to ingest with, if no role is specified the default roles assigned to user will be selected.

{% /codeInfo %}

#### Source Configuration - Source Config

{% codeInfo srNumber=12 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json):

**markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.

**includeTables**: true or false, to ingest table data. Default is true.

**includeViews**: true or false, to ingest views definitions.

**databaseFilterPattern**, **schemaFilterPattern**, **tableFilterPattern**: Note that the filter supports regex as include or exclude. You can find examples [here](/connectors/ingestion/workflows/metadata/filter-patterns/database)

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=13 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.1/connectors/workflow-config.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=10 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=11 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: snowflake
  serviceName: <service name>
  serviceConnection:
    config:
      type: Snowflake
```
```yaml {% srNumber=1 %}
      username: <username>
```
```yaml {% srNumber=2 %}
      password: <password>
```
```yaml {% srNumber=3 %}
      warehouse: <warehouse>
```
```yaml {% srNumber=4 %}
      account: <account>
```
```yaml {% srNumber=5 %}
      # database: <database>
```
```yaml {% srNumber=6 %}
      includeTempTables: false
```
```yaml {% srNumber=39 %}
      clientSessionKeepAlive: false
```
```yaml {% srNumber=7 %}
      # privateKey: <privateKey>
```
```yaml {% srNumber=8 %}
      # snowflakePrivatekeyPassphrase: <passphrase>
```
```yaml {% srNumber=9 %}
      # role: <role>
```
```yaml {% srNumber=10 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=11 %}
      # connectionArguments:
      #   key: value
```


```yaml {% srNumber=12 %}
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

```yaml {% srNumber=13 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.1/connectors/workflow-config-yaml.md" /%}

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

This is a sample config for Snowflake Usage:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=15 %}

#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryUsagePipeline.json).

**queryLogDuration**: Configuration to tune how far we want to look back in query logs to process usage data.

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**stageFileLocation**: Temporary file name to store the query logs before processing. Absolute file path required.

{% /codeInfo %}

{% codeInfo srNumber=17 %}

**resultLimit**: Configuration to set the limit for query logs

{% /codeInfo %}

{% codeInfo srNumber=18 %}

**queryLogFilePath**: Configuration to set the file path for query logs

{% /codeInfo %}


{% codeInfo srNumber=19 %}

#### Processor, Stage and Bulk Sink Configuration

To specify where the staging files will be located.

Note that the location is a directory that will be cleaned at the end of the ingestion.

{% /codeInfo %}

{% codeInfo srNumber=20 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: snowflake-usage
  serviceName: <service name>
  sourceConfig:
    config:
      type: DatabaseUsage
```
```yaml {% srNumber=15 %}
      # Number of days to look back
      queryLogDuration: 7
```

```yaml {% srNumber=16 %}
      # This is a directory that will be DELETED after the usage runs
      stageFileLocation: <path to store the stage file>
```

```yaml {% srNumber=17 %}
      # resultLimit: 1000
```

```yaml {% srNumber=18 %}
      # If instead of getting the query logs from the database we want to pass a file with the queries
      # queryLogFilePath: path-to-file
```

```yaml {% srNumber=19 %}
processor:
  type: query-parser
  config: {}
stage:
  type: table-usage
  config:
    filename: /tmp/snowflake_usage
bulkSink:
  type: metadata-usage
  config:
    filename: /tmp/snowflake_usage
```

```yaml {% srNumber=20 %}
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
pip3 install --upgrade 'openmetadata-ingestion[snowflake-usage]'
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

{% codeInfo srNumber=21 %}
#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json).

**generateSampleData**: Option to turn on/off generating sample data.

{% /codeInfo %}

{% codeInfo srNumber=22 %}

**profileSample**: Percentage of data or no. of rows we want to execute the profiler and tests on.

{% /codeInfo %}

{% codeInfo srNumber=23 %}

**threadCount**: Number of threads to use during metric computations.

{% /codeInfo %}

{% codeInfo srNumber=24 %}

**processPiiSensitive**: Optional configuration to automatically tag columns that might contain sensitive information.

{% /codeInfo %}

{% codeInfo srNumber=25 %}

**confidence**: Set the Confidence value for which you want the column to be marked

{% /codeInfo %}


{% codeInfo srNumber=26 %}

**timeoutSeconds**: Profiler Timeout in Seconds

{% /codeInfo %}

{% codeInfo srNumber=27 %}

**databaseFilterPattern**: Regex to only fetch databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=28 %}

**schemaFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=29 %}

**tableFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=30 %}

#### Processor Configuration

Choose the `orm-profiler`. Its config can also be updated to define tests from the YAML itself instead of the UI:

**tableConfig**: `tableConfig` allows you to set up some configuration at the table level.
{% /codeInfo %}


{% codeInfo srNumber=31 %}

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.
{% /codeInfo %}


{% codeInfo srNumber=32 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: snowflake
  serviceName: local_snowflake
  sourceConfig:
    config:
      type: Profiler
```

```yaml {% srNumber=21 %}
      generateSampleData: true
```
```yaml {% srNumber=22 %}
      # profileSample: 85
```
```yaml {% srNumber=23 %}
      # threadCount: 5
```
```yaml {% srNumber=24 %}
      processPiiSensitive: false
```
```yaml {% srNumber=25 %}
      # confidence: 80
```
```yaml {% srNumber=26 %}
      # timeoutSeconds: 43200
```
```yaml {% srNumber=27 %}
      # databaseFilterPattern:
      #   includes:
      #     - database1
      #     - database2
      #   excludes:
      #     - database3
      #     - database4
```
```yaml {% srNumber=28 %}
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
```
```yaml {% srNumber=29 %}
      # tableFilterPattern:
      #   includes:
      #     - table1
      #     - table2
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=30 %}
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
    #       partitionColumnName: <partition column name>
    #       partitionIntervalType: <TIME-UNIT, INTEGER-RANGE, INGESTION-TIME, COLUMN-VALUE>
    #       Pick one of the variation shown below
    #       ----'TIME-UNIT' or 'INGESTION-TIME'-------
    #       partitionInterval: <partition interval>
    #       partitionIntervalUnit: <YEAR, MONTH, DAY, HOUR>
    #       ------------'INTEGER-RANGE'---------------
    #       partitionIntegerRangeStart: <integer>
    #       partitionIntegerRangeEnd: <integer>
    #       -----------'COLUMN-VALUE'----------------
    #       partitionValues:
    #         - <value>
    #         - <value>

```

```yaml {% srNumber=31 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=32 %}
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

{% codeInfo srNumber=33 %}

#### Import necessary modules

The `ProfilerWorkflow` class that is being imported is a part of a metadata orm_profiler framework, which defines a process of extracting Profiler data. 

Here we are also importing all the basic requirements to parse YAMLs, handle dates and build our DAG.

{% /codeInfo %}

{% codeInfo srNumber=34 %}

**Default arguments for all tasks in the Airflow DAG.** 
- Default arguments dictionary contains default arguments for tasks in the DAG, including the owner's name, email address, number of retries, retry delay, and execution timeout.

{% /codeInfo %}


{% codeInfo srNumber=35 %}

- **config**: Specifies config for the profiler as we prepare above.

{% /codeInfo %}

{% codeInfo srNumber=36 %}

- **metadata_ingestion_workflow()**: This code defines a function `metadata_ingestion_workflow()` that loads a YAML configuration, creates a `ProfilerWorkflow` object, executes the workflow, checks its status, prints the status to the console, and stops the workflow.

{% /codeInfo %}

{% codeInfo srNumber=37 %}

- **DAG**: creates a DAG using the Airflow framework, and tune the DAG configurations to whatever fits with your requirements
- For more Airflow DAGs creation details visit [here](https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html#declaring-a-dag).

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.py" %}

```python {% srNumber=33 %}
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
```python {% srNumber=34 %}
default_args = {
   "owner": "user_name",
   "email_on_failure": False,
   "retries": 3,
   "retry_delay": timedelta(seconds=10),
   "execution_timeout": timedelta(minutes=60),
}


```

```python {% srNumber=35 %}
config = """
<your YAML configuration>
"""


```

```python {% srNumber=36 %}
def metadata_ingestion_workflow():
   workflow_config = yaml.safe_load(config)
   workflow = ProfilerWorkflow.create(workflow_config)
   workflow.execute()
   workflow.raise_from_status()
   workflow.print_status()
   workflow.stop()


```

```python {% srNumber=37 %}
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
