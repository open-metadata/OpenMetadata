---
description: Use the 'metadata' CLI to run a one-time ingestion
---

# Run Redash Connector with the CLI

Configure and schedule Redash **metadata** workflows using CLI.

* [Requirements](run-metabase-connector-with-the-cli.md#requirements)
* [Metadata Ingestion](run-metabase-connector-with-the-cli.md#metadata-ingestion)

## Requirements

Follow this [guide](../../../docs/integrations/airflow/) to learn how to set up Airflow to run the metadata ingestions.

### Python requirements

To run the Redash ingestion, you will need to install:

```
pip3 install 'openmetadata-ingestion[redash]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/dashboard/redashConnection.json) you can find the structure to create a connection to Redash.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the YAML Config

This is a sample config for Redash:

```json
source:
  type: redash
  serviceName: local_redash
  serviceConnection:
    config:
      type: Redash
      hostPort: http://localhost:5000
      apiKey: api_key
      username: random
  sourceConfig:
    config:
      dashboardFilterPattern: {}
      chartFilterPattern: {}
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth

```

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/dashboard/redashConnection.json).

* **username**: Enter the username of your Redash user in the _Username_ field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow.
* **password**: Enter the password for your Redash user in the _Password_ field.
* **hostPort**: Enter the fully qualified hostname and port number for your Redash deployment in the _Host and Port_ field.
* **dbServiceName**: If you want create Lineage enter the database Service name.

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/dashboardServiceMetadataPipeline.json).

* **dashboardFilterPattern** and **chartFilterPattern**: Note that the `dashboardFilterPattern` and `chartFilterPattern` both support regex as `include` or `exclude`. E.g.,

```
dashboardFilterPattern:
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
