---
description: Use the 'metadata' CLI to run a one-time ingestion
---

# Run DynamoDB Connector with the CLI

Configure and schedule DynamoDB **metadata** workflows using your the `metadata` CLI.

* [Requirements](run-dynamodb-connector-with-the-cli.md#requirements)
* [Metadata Ingestion](run-dynamodb-connector-with-the-cli.md#metadata-ingestion)

## Requirements

Follow this [guide](../../../docs/integrations/airflow/) to learn how to set up Airflow to run the metadata ingestions.

### Python requirements

To run the DynamoDB ingestion, you will need to install:

```
pip3 install 'openmetadata-ingestion[dynamodb]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/dynamoDBConnection.json) you can find the structure to create a connection to DynamoDB.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modelled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the JSON Config

This is a sample config for DynamoDB:

```javascript
source:
  type: dynamodb
  serviceName: local_dynamodb
  serviceConnection:
    config:
      type: DynamoDB
      awsConfig:
        awsAccessKeyId: aws_access_key_id
        awsSecretAccessKey: aws_secret_access_key
        awsRegion: aws region
        endPointURL: https://dynamodb.<region_name>.amazonaws.com
      database: custom_database_name
  sourceConfig:
    config:
      enableDataProfiler: false
      tableFilterPattern:
        includes:
        - ''
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth

```

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **enableDataProfiler**: DynamoDB does not provide query capabilities, so the profiler is not supported.
* **markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.
* **includeTables**: `true` or `false`, to ingest table data. Default is true.
* **includeViews**: `true` or `false`, to ingest views definitions.
* **generateSampleData**: DynamoDB does not provide query capabilities, so sample data is not supported.
* **sampleDataQuery**: Defaults to `select * from {}.{} limit 50`.
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

```
tableFilterPattern:
  includes:
    - users
    - type_test
```

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

#### OpenMetadata Security Providers

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/security/client). An example of an Auth0 configuration would be the following:

```
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: auth0
    securityConfig:
      clientId: <client ID>
      secretKey: <secret key>
      domain: <domain>
```

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the JSON configuration, you will be able to extract metadata from different sources.
