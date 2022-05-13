---
description: Use the 'metadata' CLI to run a one-time ingestion
---

# Run Presto Connector using CLI

Configure and schedule Presto **metadata**, and **profiler** workflows using your own Airflow instances.

* [Requirements](run-presto-connector-using-cli.md#requirements)
* [Metadata Ingestion](run-presto-connector-using-cli.md#metadata-ingestion)
* [Data Profiler and Quality Tests](run-presto-connector-using-cli.md#data-profiler-and-quality-tests)
* [DBT Integration](run-presto-connector-using-cli.md#dbt-integration)

## Requirements

Follow this [guide](../../../docs/integrations/airflow/) to learn how to set up Airflow to run the metadata ingestions.

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/prestoConnection.json) you can find the structure to create a connection to Presto.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the YAML Config

This is a sample config for Presto:

```yaml
source:
  type: presto
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: Presto
      hostPort: "<hostPort>"
      username: "<username>"
      catalog: "<catalog>"
      database: "<database>"
  sourceConfig:
    config:
      enableDataProfiler: true or false
      markDeletedTables: true or false
      includeTables: true or false
      includeViews: true or false
      generateSampleData: true or false
      sampleDataQuery: "<query to fetch table data>"
      schemaFilterPattern: "<schema name regex list>"
      tableFilterPattern: "<table name regex list>"
      dbtConfigSource: "<DBT configuration>"
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "<OpenMetadata host and port>"
    authProvider: "<OpenMetadata auth provider>"

```

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/prestoConnection.json).

* **hostPort**: Host and port of the data source.
* **username** (Optional): Specify the User to connect to Presto. It should have enough privileges to read all the metadata.
* **password** (Optional): Connection password.
* **catalog**: A Presto catalog contains schemas and references a data source via a connector.
* **database** (Optional): The database of the data source is an optional parameter if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
* **connectionOptions** (Optional): Enter the details for any additional connection options that can be sent to Presto during the connection. These details must be added as Key-Value pairs.
* **connectionArguments** (Optional): Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Presto during the connection. These details must be added as Key-Value pairs.

For the Connection Arguments, In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows.

`"authenticator" : "sso_login_url"`

In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows.

`"authenticator" : "externalbrowser"`

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **enableDataProfiler**: \*\*\*\* `true` or `false`, to run the profiler (not the tests) during the metadata ingestion.
* **markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.
* **includeTables**: `true` or `false`, to ingest table data. Default is true.
* **includeViews**: `true` or `false`, to ingest views definitions.
* **generateSampleData**: To ingest sample data based on `sampleDataQuery`.
* **sampleDataQuery**: Defaults to `select * from {}.{} limit 50`.
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

```yaml
tableFilterPattern:
  includes:
   - regex1
   - regex2
   - ...
```

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

#### OpenMetadata Security Providers

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/security/client). An example of an Auth0 configuration would be the following:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: auth0
    securityConfig:
      clientId: "<client ID>"
      secretKey: "<secret key>"
      domain: "<domain>"
```

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```
metadata ingest -c <path-to-yaml>
```

{% hint style="info" %}
Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration, you will be able to extract metadata from different sources.
{% endhint %}

## Data Profiler and Quality Tests

The Data Profiler workflow will be using the `orm-profiler` processor. While the `serviceConnection` will still be the same to reach the source system, the `sourceConfig` will be updated from previous configurations.

### 1. Define the JSON configuration

This is a sample config for a Presto profiler:

```yaml
source:
  type: presto
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: Presto
      hostPort: "<hostPort>"
      username: "<username>"
      catalog: "<catalog>"
      database: "<database>"
  sourceConfig:
    config:
      type: Profiler
      fqnFilterPattern: "<table FQN filtering regex>"
processor:
  type: orm-profiler
  config: {}
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "<OpenMetadata host and port>"
    authProvider: "<OpenMetadata auth provider>"

```

#### Source Configuration

* You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/prestoConnection.json).
* The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json). If you don't need to add any `fqnFilterPattern`, the `"type": "Profiler"` is still required to be present.

Note that the `fqnFilterPattern` supports regex as `includes` or `excludes`. E.g.,

```yaml
fqnFilterPattern:
  includes:
   - regex1
   - regex2
   - ...
```

#### Processor

To choose the `orm-profiler`. It can also be updated to define tests from the JSON itself instead of the UI:

```yaml
processor:
  type: orm-profiler
  config:
    test_suite:
      name: "<Test Suite name>"
      tests:
      - table: "<Table FQN>"
        table_tests:
        - testCase:
            config:
              value: 100
            tableTestType: tableRowCountToEqual
        column_tests:
        - columnName: "<Column Name>"
          testCase:
            config:
              minValue: 0
              maxValue: 99
            columnTestType: columnValuesToBeBetween
```

`tests` is a list of test definitions that will be applied to `table`, informed by its FQN. For each table, one can then define a list of `table_tests` and `column_tests`. Review the supported tests and their definitions to learn how to configure the different cases [here](https://docs.open-metadata.org/v/0.10.0/data-quality/data-quality-overview/tests).

#### Workflow Configuration

The same as the [metadata](run-presto-connector-using-cli.md#workflow-configuration) ingestion.

### 2. Run with the CLI

Again, we will start by saving the YAML file.

Then, we can run the workflow as:

```
metadata profile -c <path-to-yaml>
```

Note how instead of running `ingest`, we are using the `profile` command to select the `Profiler` workflow.

## DBT Integration

You can learn more about how to ingest DBT models' definitions and their lineage [here](../../../data-lineage/dbt-integration/).
