---
title: Run the Hive Connector Externally
slug: /connectors/database/hive/yaml
---

# Run the Hive Connector Externally

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="cross" /%} |
| Data Profiler      | {% icon iconName="check" /%} |
| Data Quality       | {% icon iconName="check" /%} |
| Lineage            | Partially via Views          |
| DBT                | {% icon iconName="cross" /%} |
| Supported Versions | Hive >= 2.0                         |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | Partially via Views          |
| Table-level  | {% icon iconName="check" /%} |
| Column-level | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the Hive connector.

Configure and schedule Hive metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}



### Python Requirements

To run the Hive ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[hive]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/hiveConnection.json)
you can find the structure to create a connection to Hive.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Hive:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Hive. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Hive.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: Enter the fully qualified hostname and port number for your Hive deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**authOptions**: Enter the auth options string for hive connection.

{% /codeInfo %}


{% codeInfo srNumber=22 %}

#### For MySQL Metastore Connection:
You can also ingest the metadata using Mysql metastore. This step is optional if metastore details are not provided then we will query the hive server directly.

- **username**: Specify the User to connect to MySQL Metastore. It should have enough privileges to read all the metadata.
- **password**: Password to connect to MySQL.
- **hostPort**: Enter the fully qualified hostname and port number for your MySQL Metastore deployment in the Host and Port field in the format `hostname:port`.
- **databaseSchema**: Enter the database schema which is associated with the metastore.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

#### For Postgres Metastore Connection:

You can also ingest the metadata using Postgres metastore. This step is optional if metastore details are not provided then we will query the hive server directly.

- **username**: Specify the User to connect to Postgres Metastore. It should have enough privileges to read all the metadata.
- **password**: Password to connect to Postgres.
- **hostPort**: Enter the fully qualified hostname and port number for your Postgres deployment in the Host and Port field in the format `hostname:port`.
- **database**: Initial Postgres database to connect to. Specify the name of database associated with metastore instance.

{% /codeInfo %}


#### Source Configuration - Source Config

{% codeInfo srNumber=7 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json):

**markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.

**includeTables**: true or false, to ingest table data. Default is true.

**includeViews**: true or false, to ingest views definitions.

**databaseFilterPattern**, **schemaFilterPattern**, **tableFilterPattern**: Note that the filter supports regex as include or exclude. You can find examples [here](/connectors/ingestion/workflows/metadata/filter-patterns/database)

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=8 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.2/connectors/workflow-config.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=5 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: hive
  serviceName: local_hive
  serviceConnection:
    config:
      type: Hive
```
```yaml {% srNumber=1 %}
      username: <username>
```
```yaml {% srNumber=2 %}
      password: <password>
```
```yaml {% srNumber=3 %}
      authOptions: <auth options>
```
```yaml {% srNumber=4 %}
      hostPort: <hive connection host & port>
```

```yaml {% srNumber=22 %}
      # For MySQL Metastore Connection
      # metastoreConnection:
      #   type: Mysql
      #   username: <username>
      #   password: <password>
      #   hostPort: <hostPort>
      #   databaseSchema: metastore

```
```yaml {% srNumber=23 %}
      # For Postgres Metastore Connection
      # metastoreConnection:
      #   type: Postgres
      #   username: <username>
      #   password: <password>
      #   hostPort: <hostPort>
      #   database: metastore
```
```yaml {% srNumber=5 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=6 %}
      # connectionArguments:
      #   key: value
```

```yaml {% srNumber=7 %}
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

```yaml {% srNumber=8 %}
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

## Data Profiler

The Data Profiler workflow will be using the `orm-profiler` processor.

After running a Metadata Ingestion workflow, we can run Data Profiler workflow.
While the `serviceName` will be the same to that was used in Metadata Ingestion, so the ingestion bot can get the `serviceConnection` details from the server.

### 1. Define the YAML Config

This is a sample config for the profiler:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=10 %}

#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json).

**generateSampleData**: Option to turn on/off generating sample data.

{% /codeInfo %}

{% codeInfo srNumber=11 %}

**profileSample**: Percentage of data or no. of rows we want to execute the profiler and tests on.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

**threadCount**: Number of threads to use during metric computations.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

**processPiiSensitive**: Optional configuration to automatically tag columns that might contain sensitive information.

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**confidence**: Set the Confidence value for which you want the column to be marked

{% /codeInfo %}


{% codeInfo srNumber=15 %}

**timeoutSeconds**: Profiler Timeout in Seconds

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**databaseFilterPattern**: Regex to only fetch databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=17 %}

**schemaFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=18 %}

**tableFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=19 %}

#### Processor Configuration

Choose the `orm-profiler`. Its config can also be updated to define tests from the YAML itself instead of the UI:

**tableConfig**: `tableConfig` allows you to set up some configuration at the table level.
{% /codeInfo %}


{% codeInfo srNumber=20 %}

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.
{% /codeInfo %}


{% codeInfo srNumber=21 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: hive
  serviceName: local_hive
  sourceConfig:
    config:
      type: Profiler
```

```yaml {% srNumber=10 %}
      generateSampleData: true
```
```yaml {% srNumber=11 %}
      # profileSample: 85
```
```yaml {% srNumber=12 %}
      # threadCount: 5
```
```yaml {% srNumber=13 %}
      processPiiSensitive: false
```
```yaml {% srNumber=14 %}
      # confidence: 80
```
```yaml {% srNumber=15 %}
      # timeoutSeconds: 43200
```
```yaml {% srNumber=16 %}
      # databaseFilterPattern:
      #   includes:
      #     - database1
      #     - database2
      #   excludes:
      #     - database3
      #     - database4
```
```yaml {% srNumber=17 %}
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
```
```yaml {% srNumber=18 %}
      # tableFilterPattern:
      #   includes:
      #     - table1
      #     - table2
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=19 %}
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

```yaml {% srNumber=20 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=21 %}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

{% /codeBlock %}

{% /codePreview %}

- You can learn more about how to configure and run the Profiler Workflow to extract Profiler data and execute the Data Quality from [here](/connectors/ingestion/workflows/profiler)

### 2. Run with the CLI

After saving the YAML config, we will run the command the same way we did for the metadata ingestion:

```bash
metadata profile -c <path-to-yaml>
```

Note now instead of running `ingest`, we are using the `profile` command to select the Profiler workflow.

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}

## Related

{% tilesContainer %}

{% tile
    title="Ingest with Airflow"
    description="Configure the ingestion using Airflow SDK"
    link="/connectors/database/hive/airflow"
  / %}

{% /tilesContainer %}
