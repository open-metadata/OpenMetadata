---
title: DBT Ingestion CLI
slug: /openmetadata/ingestion/workflows/metadata/dbt/ingest-dbt-cli
---

# Add DBT while ingesting from CLI

Provide and configure the DBT manifest and catalog file source locations.

## Requirements

Refer to the documentation [here](https://docs.getdbt.com/docs/introduction) to setup a DBT project, generate the DBT models and store them in the catalog and manifest files.

Please make sure to have necessary permissions enabled so that the files can be read from their respective sources.

## Setting up a Redshift source connector with DBT

DBT can be ingested with source connectors like Redshift, Snowflake, BigQuery and other connectors which support DBT.

For a detailed list of connectors that support DBT [click here](https://docs.getdbt.com/docs/available-adapters).

Below example shows ingesting DBT with a Redshift service.

### Add a Redshift service in OpenMetadata

Below is a sample yaml config for Redshift service. Add the DBT Source of the manifest.json and catalog.json
```yaml
source:
  type: redshift
  serviceName: aws_redshift
  serviceConnection:
    config:
      hostPort: cluster.name.region.redshift.amazonaws.com:5439
      username: username
      password: strong_password
      database: dev
      type: Redshift
  sourceConfig:
    config:
      schemaFilterPattern:
        excludes:
        - information_schema.*
        - '[\w]*event_vw.*'
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```
Modify the sourceConfig part of the yaml config as shown below according to the preferred source for DBT manifest.json and catalog.json files

### Add DBT Source

DBT sources for manifest and catalog files can be configured as shown in the yaml configs below.

#### AWS S3 Buckets

OpenMetadata connects to the AWS s3 bucket via the credentials provided and scans the AWS s3 buckets for `manifest.json` and `catalog.json` files.

The name of the s3 bucket and prefix path to the folder in which `manifest.json` and `catalog.json` files are stored can be provided. In the case where these parameters are not provided all the buckets are scanned for the files.

```yaml
sourceConfig:
  config:
    dbtConfigSource:
      dbtSecurityConfig:
        awsAccessKeyId: <AWS Access Key Id>
        awsSecretAccessKey: <AWS Secret Access Key>
        awsRegion: AWS Region
      dbtPrefixConfig:
        dbtBucketName: <Bucket Name>
        dbtObjectPrefix: <Path of the folder in which dbt files are stored>
```

#### Google Cloud Storage Buckets

OpenMetadata connects to the GCS bucket via the credentials provided and scans the gcs buckets for `manifest.json` and `catalog.json` files.

The name of the GCS bucket and prefix path to the folder in which manifest.json and catalog.json files are stored can be provided. In the case where these parameters are not provided all the buckets are scanned for the files.

GCS credentials can be stored in two ways:
1. Entering the credentials directly into the json config
```yaml
sourceConfig:
  config:
    dbtConfigSource:
      dbtSecurityConfig:
        gcsConfig:
          type: <service_account>
          projectId: <projectId
          privateKeyId: <privateKeyId>
          privateKey: <privateKey
          clientEmail: <clientEmail>
          clientId: <clientId>
          authUri: <authUri>
          tokenUri: <tokenUri>
          authProviderX509CertUrl: <authProviderX509CertUrl>
          clientX509CertUrl: <clientX509CertUrl>
      dbtPrefixConfig:
        dbtBucketName: <Bucket Name>
        dbtObjectPrefix: <Path of the folder in which dbt files are stored>
```

2. Entering the path of file in which the GCS bucket credentials are stored.
```yaml
sourceConfig:
  config:
    dbtConfigSource:
      dbtSecurityConfig:
        gcsConfig: <path of gcs credentials file>
      dbtPrefixConfig:
        dbtBucketName: <Bucket Name>
        dbtObjectPrefix: <Path of the folder in which dbt files are stored>
```

#### Local Storage

Path of the `manifest.json` and `catalog.json` files stored in the local system or in the container in which openmetadata server is running can be directly provided.

```yaml
sourceConfig:
  config:
    dbtConfigSource:
      dbtCatalogFilePath: <catalog.json file path>
      dbtManifestFilePath: <manifest.json file path>
```

#### File Server

File server path of the manifest.json and catalog.json files stored on a file server directly provided.

```yaml
sourceConfig:
  config:
    dbtConfigSource:
      dbtCatalogHttpPath: <catalog.json file path>
      dbtManifestHttpPath: <manifest.json file path>
```

#### DBT Cloud

Click on the the link [here](https://docs.getdbt.com/guides/getting-started) for getting started with DBT cloud account setup if not done already.
OpenMetadata uses DBT cloud APIs to fetch the `run artifacts` (manifest.json and catalog.json) from the most recent DBT run.
The APIs need to be authenticated using an Authentication Token. Follow the link [here](https://docs.getdbt.com/dbt-cloud/api-v2#section/Authentication) to generate an authentication token for your DBT cloud account.

```yaml
sourceConfig:
  config:
    dbtConfigSource:
      dbtCloudAuthToken: dbt_cloud_auth_token
      dbtCloudAccountId: dbt_cloud_account_id
```