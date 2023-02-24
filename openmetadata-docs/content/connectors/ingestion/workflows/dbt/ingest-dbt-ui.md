---
title: Ingest dbt UI
slug: /connectors/ingestion/workflows/dbt/ingest-dbt-ui
---

# dbt Workflow UI
Learn how to configure the dbt workflow from the UI to ingest dbt data from your data sources.

## UI Configuration

Once the metadata ingestion runs correctly and we are able to explore the service Entities, we can add the dbt information.

This will populate the dbt tab from the Table Entity Page.

<Image src="/images/openmetadata/ingestion/workflows/dbt/dbt-features/dbt-query.webp" alt="dbt" caption="dbt"/>

We can create a workflow that will obtain the dbt information from the dbt files and feed it to OpenMetadata. The dbt Ingestion will be in charge of obtaining this data.

### 1. Add a dbt Ingestion

From the Service Page, go to the Ingestions tab to add a new ingestion and click on Add dbt Ingestion.

<Image src="/images/openmetadata/ingestion/workflows/dbt/add-ingestion.webp" alt="add-ingestion" caption="Add dbt Ingestion"/>

### 2. Configure the dbt Ingestion

Here you can enter the dbt Ingestion details:
### Add dbt Source

dbt sources for manifest.json, catalog.json and run_results.json files can be configured as shown in the UI below. The dbt files are needed to be stored on one of these sources.

<Note>

Only the `manifest.json` file is compulsory for dbt ingestion.

</Note>


#### AWS S3 Buckets

OpenMetadata connects to the AWS s3 bucket via the credentials provided and scans the AWS s3 buckets for `manifest.json`, `catalog.json` and `run_results.json` files.

The name of the s3 bucket and prefix path to the folder in which the dbt files are stored can be provided. In the case where these parameters are not provided all the buckets are scanned for the files.

<Image src="/images/openmetadata/ingestion/workflows/dbt/aws-s3.webp" alt="aws-s3-bucket" caption="AWS S3 Bucket Config"/>

#### Google Cloud Storage Buckets

OpenMetadata connects to the GCS bucket via the credentials provided and scans the gcs buckets for `manifest.json`, `catalog.json` and `run_results.json` files.

The name of the GCS bucket and prefix path to the folder in which the dbt files are stored can be provided. In the case where these parameters are not provided all the buckets are scanned for the files.

GCS credentials can be stored in two ways:
1. Entering the credentials directly into the form

<Image src="/images/openmetadata/ingestion/workflows/dbt/gcs-bucket-form.webp" alt="gcs-storage-bucket-form" caption="GCS Bucket config"/>

2. Entering the path of file in which the GCS bucket credentials are stored.

<Image src="/images/openmetadata/ingestion/workflows/dbt/gcs-bucket-path.webp" alt="gcs-storage-bucket-path" caption="GCS Bucket Path Config"/>

For more information on Google Cloud Storage authentication click [here](https://cloud.google.com/docs/authentication/getting-started#create-service-account-console).

#### Local Storage

Path of the `manifest.json`, `catalog.json` and `run_results.json` files stored in the local system or in the container in which openmetadata server is running can be directly provided.

<Image src="/images/openmetadata/ingestion/workflows/dbt/local-storage.webp" alt="local-storage" caption="Local Storage Config"/>

#### File Server

File server path of the `manifest.json`, `catalog.json` and `run_results.json` files stored on a file server directly provided.

<Image src="/images/openmetadata/ingestion/workflows/dbt/file_server.webp" alt="file-server" caption="File Server Config"/>

#### dbt Cloud

Click on the the link [here](https://docs.getdbt.com/guides/getting-started) for getting started with dbt cloud account setup if not done already.
OpenMetadata uses dbt cloud APIs to fetch the `run artifacts` (manifest.json, catalog.json and run_results.json) from the most recent dbt run.
The APIs need to be authenticated using an Authentication Token. Follow the link [here](https://docs.getdbt.com/dbt-cloud/api-v2#section/Authentication) to generate an authentication token for your dbt cloud account.

<Image src="/images/openmetadata/ingestion/workflows/dbt/dbt-cloud.webp" alt="dbt-cloud" caption="dbt Cloud config"/>

### 3. Schedule and Deploy
After clicking Next, you will be redirected to the Scheduling form. This will be the same as the Metadata Ingestion. Select your desired schedule and click on Deploy to find the lineage pipeline being added to the Service Ingestions.

<Image src="/images/openmetadata/ingestion/workflows/dbt/schedule-and-deploy.webp" alt="schedule-and-deploy" caption="Schedule dbt ingestion pipeline"/>