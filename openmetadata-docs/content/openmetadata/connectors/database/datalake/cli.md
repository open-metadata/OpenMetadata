---
title: Run Datalake Connector using the CLI
slug: /openmetadata/connectors/database/datalake/cli
---

<ConnectorIntro connector="Datalake" />

<Requirements />

<PythonMod connector="DataLake" module="datalake" />

## Metadata Ingestion
All connectors are defined as JSON Schemas. Here you can find the structure to create a connection to Datalake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following JSON Schema.

## 1. Define the YAML Config
This is a sample config for Datalake using AWS S3:

```yaml

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

#### Source Configuration - Source Config using AWS S3

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **awsAccessKeyId**: Enter your secure access key ID for your DynamoDB connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
* **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
* **awsRegion**: Specify the region in which your DynamoDB is located. This setting is required even if you have configured a local AWS profile.
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

This is a sample config for Datalake using GCS:

```yaml


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


#### Source Configuration - Service Connection using GCS

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **type**: Credentials type, e.g. `service_account`.
* **projectId**
* **privateKey**
* **privateKeyId**
* **clientEmail**
* **clientId**
* **authUri**: [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
* **tokenUri**: [https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token) by default
* **authProviderX509CertUrl**: [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
* **clientX509CertUrl**
* **bucketName**: name of the bucket in GCS
* **Prefix**: prefix in gcs bucket
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

<MetadataIngestionConfig service="database" connector="Datalake" goal="CLI" />
