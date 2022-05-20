---
description: Use the 'metadata' CLI to run a one-time ingestion
---

# Run Glue Connector with the CLI

Configure and schedule Glue **metadata** workflows using your the `metadata` CLI.

* [Requirements](run-glue-connector-with-the-cli.md#requirements)
* [Metadata Ingestion](run-glue-connector-with-the-cli.md#metadata-ingestion)

## Requirements

Follow this [guide](../../airflow/) to learn how to set up Airflow to run the metadata ingestions.

### Python requirements

To run the Glue ingestion, you will need to install:

```
pip3 install 'openmetadata-ingestion[glue]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/glueConnection.json) you can find the structure to create a connection to Glue.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modelled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the JSON Config

This is a sample config for Glue:

```json
{
    "source": {
      "type": "glue",
      "serviceName": "local_glue",
      "serviceConnection": {
        "config": {
          "type": "Glue",
          "awsConfig": {
            "awsAccessKeyId": "KEY",
            "awsSecretAccessKey": "SECRET",
            "awsRegion": "us-east-2",
            "endPointURL": "https://glue.us-east-2.amazonaws.com/"
          },
          "storageServiceName":"storage_name",
	  "pipelineServiceName":"local_glue_pipeline"
        }
      },
      "sourceConfig": {
        "config": {
           "enableDataProfiler": true or false,
           "markDeletedTables": true or false,
           "includeTables": true or false,
           "includeViews": true or false,
           "generateSampleData": true or false,
           "sampleDataQuery": "<query to fetch table data>",
           "schemaFilterPattern": "<schema name regex list>",
           "tableFilterPattern": "<table name regex list>",
           "dbtConfigSource": "<configs for gcs, s3, local or file server to get the DBT files"
        }
      }
    },
    "sink": {
      "type": "metadata-rest",
      "config": {}
    },
    "workflowConfig": {
      "openMetadataServerConfig": {
        "hostPort": "http://localhost:8585/api",
        "authProvider": "no-auth"
      }
    }
  }
```

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **enableDataProfiler**: Glue does not provide query capabilities, so the profiler is not supported.
* **markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.
* **includeTables**: `true` or `false`, to ingest table data. Default is true.
* **includeViews**: `true` or `false`, to ingest views definitions.
* **generateSampleData**: Glue does not provide query capabilities, so sample data is not supported.
* **sampleDataQuery**: Defaults to `select * from {}.{} limit 50`.
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

```
"tableFilterPattern": {
  "includes": ["users", "type_test"]
}
```

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```
"workflowConfig": {
  "openMetadataServerConfig": {
    "hostPort": "http://localhost:8585/api",
    "authProvider": "no-auth"
  }
}
```

#### OpenMetadata Security Providers

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/security/client). An example of an Auth0 configuration would be the following:

```
"workflowConfig": {
    "openMetadataServerConfig": {
        "hostPort": "http://localhost:8585/api",
        "authProvider": "auth0",
        "securityConfig": {
            "clientId": "<client ID>",
            "secretKey": "<secret key>",
            "domain": "<domain>"
        }
    }
}
```

### 2. Run with the CLI

First, we will need to save the JSON file. Afterward, and with all requirements installed, we can run:

```
metadata ingest -c <path-to-json>
```

Note that from connector to connector, this recipe will always be the same. By updating the JSON configuration, you will be able to extract metadata from different sources.
