---
description: Use your own Airflow instance to schedule and run the MLflow Connector.
---

# Run MLflow Connector with the Airflow SDK

Configure and schedule MLflow **metadata** workflow using your own Airflow instances.

* [Requirements](run-mlflow-connector-with-the-airflow-sdk.md#requirements)
* [Metadata Ingestion](run-mlflow-connector-with-the-airflow-sdk.md#metadata-ingestion)

## Requirements

Follow this [guide](../../airflow/) to learn how to set up Airflow to run the metadata ingestions.

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/mysqlConnection.json) you can find the structure to create a connection to MLflow.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the YAML Config

This is a sample config for MLflow:

```json
source:
  type: mlflow
  serviceName: local_mlflow
  serviceConnection:
    config:
      type: Mlflow
      trackingUri: http://localhost:5000
      registryUri: mysql+pymysql://mlflow:password@localhost:3307/experiments
  sourceConfig:
    config:
      type: MlModelMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/mlmodel/mlflowConnection.json).

* **trackingUri**: The MLflow Tracking component is an API and UI for logging parameters, code versions, metrics, and output files when running your machine learning code and for later visualizing the results.
* **registryUri**: The MLflow Model Registry component is a centralized model store, set of APIs, and UI, to collaboratively manage the full lifecycle of an MLflow Model.

#### Source Configuration - Source Config

No specific configuration is required here as of now.

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort": http://localhost:8585/api
    authProvider": no-auth
```

#### OpenMetadata Security Providers

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/security/client). An example of an Auth0 configuration would be the following:

```yaml
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
