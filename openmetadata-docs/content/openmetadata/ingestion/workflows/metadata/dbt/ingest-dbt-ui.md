---
title: DBT Ingestion UI
slug: /openmetadata/ingestion/workflows/metadata/dbt/ingest-dbt-ui
---

# Add DBT while ingesting from UI

Provide and configure the DBT manifest and catalog file source locations.

## Requirements

Refer to the documentation [here](https://docs.getdbt.com/docs/introduction) to setup a DBT project, generate the DBT models and store them in the catalog and manifest files.

Please make sure to have necessary permissions enabled so that the files can be read from their respective sources.

## Setting up a Redshift source connector with DBT

DBT can be ingested with source connectors like Redshift, Snowflake, BigQuery and other connectors which support DBT.
For a detailed list of connectors that support DBT [click here](https://docs.getdbt.com/docs/available-adapters).

Below example shows ingesting DBT with a Redshift service.

### Add a Redshift service in OpenMetadata

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_ui/add-service.png" alt="select-service" caption="Select Service"/>

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_ui/enter-service-name.png" alt="enter-service-name" caption="Enter name of the service"/>

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_ui/configure-service.png" alt="add-new-service" caption="Configure the service"/>

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_ui/add-ingestion.png" alt="add-ingestion" caption="Add Ingestion"/>

### Add DBT Source

DBT sources for manifest and catalog files can be configured as shown UI below. The DBT files are needed to be stored on one of these sources.

#### AWS S3 Buckets

OpenMetadata connects to the AWS s3 bucket via the credentials provided and scans the AWS s3 buckets for `manifest.json` and `catalog.json` files.

The name of the s3 bucket and prefix path to the folder in which `manifest.json` and `catalog.json` files are stored can be provided. In the case where these parameters are not provided all the buckets are scanned for the files.

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_ui/s3-bucket.png" alt="aws-s3-bucket" caption="S3 Bucket Config"/>

#### Google Cloud Storage Buckets

OpenMetadata connects to the GCS bucket via the credentials provided and scans the gcs buckets for `manifest.json` and `catalog.json` files.

The name of the GCS bucket and prefix path to the folder in which `manifest.json` and `catalog.json` files are stored can be provided. In the case where these parameters are not provided all the buckets are scanned for the files.

GCS credentials can be stored in two ways:
1. Entering the credentials directly into the form

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_ui/gcs-bucket-form.png" alt="gcs-storage-bucket-form" caption="GCS Bucket config"/>

2. Entering the path of file in which the GCS bucket credentials are stored.

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_ui/gcs-bucket-path.png" alt="gcs-storage-bucket-path" caption="GCS Bucket Path Config"/>

For more information on Google Cloud Storage authentication click [here](https://cloud.google.com/docs/authentication/getting-started#create-service-account-console).

#### Local Storage

Path of the manifest.json and catalog.json files stored in the local system or in the container in which openmetadata server is running can be directly provided.

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_ui/local-storage.png" alt="local-storage" caption="Local Storage Config"/>

#### File Server

File server path of the manifest.json and catalog.json files stored on a file server directly provided.

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest-dbt-ui/file_server.png" alt="file-server" caption="File Server Config"/>

#### DBT Cloud

Click on the the link [here](https://docs.getdbt.com/guides/getting-started) for getting started with DBT cloud account setup if not done already.
OpenMetadata uses DBT cloud APIs to fetch the `run artifacts` (manifest.json and catalog.json) from the most recent DBT run.
The APIs need to be authenticated using an Authentication Token. Follow the link [here](https://docs.getdbt.com/dbt-cloud/api-v2#section/Authentication) to generate an authentication token for your DBT cloud account.

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_ui/dbt-cloud.png" alt="dbt-cloud" caption="DBT Cloud config"/>