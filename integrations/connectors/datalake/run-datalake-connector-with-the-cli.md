---
description: Use the 'metadata' CLI to run a one-time ingestion
---

# Run Datalake Connector with the CLI

Configure and schedule Datalake **metadata** workflows using your the `metadata` CLI.

* [Requirements](run-datalake-connector-with-the-cli.md#requirements)
* [Metadata Ingestion](run-datalake-connector-with-the-cli.md#metadata-ingestion)

## Requirements

Follow this [guide](../../../docs/integrations/airflow/) to learn how to set up Airflow to run the metadata ingestions.

### Python requirements

To run the Datalake ingestion, you will need to install:

```
pip3 install 'openmetadata-ingestion[datalake]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/datalakeConnection.json) you can find the structure to create a connection to Datalake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modelled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the YAML Config

This is a sample config for Datalake:

```javascript
source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
      configSource:      
        securityConfig: 
          awsAccessKeyId: aws access key id
          awsSecretAccessKey: aws secret access key
          awsRegion: aws region
      bucketName: bucket name
      prefix: prefix
  sourceConfig:
    config:
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

* **awsAccessKeyId**: Enter your secure access key ID for your DynamoDB connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
* **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
* **awsRegion**: Specify the region in which your DynamoDB is located. This setting is required even if you have configured a local AWS profile.
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

```
tableFilterPattern:
  includes:
    - users
    - type_test
```

This is a sample config for Datalake using GCS:

```
source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
      configSource:      
        securityConfig: 
          gcsConfig:
            type: type of account
            projectId: project id
            privateKeyId: private key id
            privateKey: private key
            clientEmail: client email
            clientId: client id
            authUri: https://accounts.google.com/o/oauth2/auth
            tokenUri: https://oauth2.googleapis.com/token
            authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs
            clientX509CertUrl:  clientX509 Certificate Url
      bucketName: bucket name
      prefix: prefix
  sourceConfig:
    config:
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

* **type**: Credentials type, e.g. `service_account`.
* **projectId**
* **privat**eKe**y**
* **privateKeyId**
* **clientEmail**
* **clientId**
* **authUri**: [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
* **tokenUri**: [https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token) by default
* **authProviderX509CertUrl**: [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
* **clientX509CertUrl**
* **bucketName :** name of the bucket in GCS
* **Prefix** :  prefix in gcs bucket
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

```
tableFilterPattern:
  includes:
    - users
    - type_test
```



#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

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
