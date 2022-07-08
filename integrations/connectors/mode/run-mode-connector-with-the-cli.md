---
description: Use the 'metadata' CLI to run a one-time ingestion
---

# Run Mode Connector with the CLI

Configure and schedule mode **metadata** workflows using CLI.

* [Requirements](run-mode-connector-with-the-cli.md#requirements)
* [Metadata Ingestion](run-mode-connector-with-the-cli.md#metadata-ingestion)

## Requirements

Follow this [guide](../../airflow/) to learn how to set up Airflow to run the metadata ingestions.

### Python requirements

To run the Mode ingestion, you will need to install:

```
pip3 install 'openmetadata-ingestion[mode]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/dashboard/supersetConnection.json) you can find the structure to create a connection to Mode.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the YAML Config

This is a sample config for Mode:

```json
source:
  type: mode
  serviceName: local_mode
  serviceConnection:
    config:
      access_token: access_token
      access_token_password: access_token_password
      workspace_name: workspace_name
      type: Mode
  sourceConfig:
    config:
      chartFilterPattern:
        includes:
          - Gross Margin %
          - Total Defect*
          - "Number"
        excludes:
          - Total Revenue
      dashboardFilterPattern:
        includes:
          - Supplier Quality Analysis Sample
          - "Customer"
      dbServiceName: local_redshift
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/dashboard/modeConnection.json).

* **Host and Port**: Enter the fully qualified hostname and port number for your Mode deployment in the _Host and Port_ field.
* **Access Token and Access Token Password**: Enter the access token for the Mode workspace. Click [here](https://mode.com/developer/api-reference/authentication/) for the documentation regarding generation of _access token_ and _access token password_.
* **Workspace Name**: Enter the workspace name of your Mode environment.

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

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration, you will be able to extract metadata from different sources.
