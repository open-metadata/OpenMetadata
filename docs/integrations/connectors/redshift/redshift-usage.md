---
description: >-
  This guide will help you install and configure the Redshift Usage connector
  and run metadata ingestion workflows manually.
---

# Run Redshift Connector with the CLI

## Requirements

Follow this [guide](../../airflow/) to learn how to set up Airflow to run the metadata ingestions.

### Python requirements

To run the Snowflake ingestion, you will need to install:

```
pip install 'openmetadata-ingestion[snowflake]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json) you can find the structure to create a connection to Snowflake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the JSON Config

This is a sample config for Snowflake:

```json
{
  "source": {
    "type": "redshift",
    "serviceName": "aws_redshift",
    "serviceConnection": {
      "config": {
        "type": "Redshift",
        "hostPort": "cluster.name.region.redshift.amazonaws.com:5439",
        "username": "username",
        "password": "strong_password",
        "database": "dev"
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
            "dbtProvider": "<s3, gcs, gcs-path, local or http>",
            "dbtConfig": "<for the selected provider>",
            "dbtCatalogFileName": "<file name>",
            "dbtManifestFileName": "<file name>"
        }
     }
    },
    "sink": {
        "type": "metadata-rest",
        "config": {}
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "<OpenMetadata host and port>",
            "authProvider": "<OpenMetadata auth provider>"
        }
    }
}
}
```

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json).

* **username**: Enter the username of your Redshift user in the _Username_ field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow.
* **password**: Enter the password for your Redshift user in the _Password_ field.
* **hostPort**: Enter the fully qualified hostname and port number for your Redshift deployment in the _Host and Port_ field.
* **database**: If you want to limit metadata ingestion to a single database, enter the name of this database in the Database field. If no value is entered for this field, the connector will ingest metadata from all databases that the specified user is authorized to read.
* **connectionOptions** (Optional): Enter the details for any additional connection options that can be sent to Redshift during the connection. These details must be added as Key-Value pairs.
* **connectionArguments** (Optional): Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Redshift during the connection. These details must be added as Key-Value pairs.

You can configure SSL options for the Redshift connection as `connectionArguments`. The key should be `sslmode` and accepts the following values:

* `verify-ca`: The Redshift connector will verify that the server is trustworthy by checking the certificate chain up to a trusted certificate authority (CA).
* `verify-full`: The Redshift connector will also verify that the server hostname matches its certificate. The SSL connection will fail if the server certificate cannot be verified. `verify-full` is recommended in most security-sensitive environments.
* `require`: If a root CA file exists, the behavior of `sslmode=require` will be the same as that of `verify-ca`, meaning the server certificate is validated against the CA. Relying on this behavior is discouraged, and applications that need certificate validation should always use `verify-ca` or `verify-full`.&#x20;

In `verify-full` mode, the cn (Common Name) attribute of the certificate is matched against the hostname. If the cn attribute starts with an asterisk (\*), it will be treated as a wildcard, and will match all characters except a dot (.). This means the certificate will not match subdomains. If the connection is made using an IP address instead of a hostname, the IP address will be matched (without doing any DNS lookups).

You can find more information in the AWS [docs](https://docs.aws.amazon.com/redshift/latest/mgmt/connecting-ssl-support.html).

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **enableDataProfiler**: **** `true` or `false`, to run the profiler (not the tests) during the metadata ingestion.
* **markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.
* **includeTables**: `true` or `false`, to ingest table data. Default is true.
* **includeViews**: `true` or `false`, to ingest views definitions.
* **generateSampleData**: To ingest sample data based on `sampleDataQuery`.
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

##
