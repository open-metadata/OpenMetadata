---
title: BigQuery | OpenMetadata Connector Setup & Integration Guide
description: Connect BigQuery to OpenMetadata seamlessly with our comprehensive database connector guide. Setup instructions, configuration tips, and metadata extrac...
slug: /connectors/database/bigquery
---

{% connectorDetailsHeader
name="BigQuery"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "dbt", "Tags", "Stored Procedures", "Sample Data", "Reverse Metadata (Collate Only)"]
unavailableFeatures=["Owners"]
/ %}


In this section, we provide guides and references to use the BigQuery connector.

Configure and schedule BigQuery metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Incremental Extraction](/connectors/ingestion/workflows/metadata/incremental-extraction/bigquery)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality/configure)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/bigquery/troubleshooting)
{% collateContent %}
- [Reverse Metadata](#reverse-metadata)
{% /collateContent %}


{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/bigquery/yaml"} /%}

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

You need to create an service account in order to ingest metadata from bigquery refer [this](/connectors/database/bigquery/create-credentials) guide on how to create service account.

{% tilesContainer %}
{% tile
icon="manage_accounts"
title="Create Custom GCP Role"
description="Check out this documentation on how to create a custom role and assign it to the service account."
link="/connectors/database/bigquery/create-credentials"
  / %}
{% /tilesContainer %}

{% partial file="/v1.8/connectors/database/partitioned-tables.md" /%}

### Data Catalog API Permissions 

- Go to [https://console.cloud.google.com/apis/library/datacatalog.googleapis.com](https://console.cloud.google.com/apis/library/datacatalog.googleapis.com)
- Select the `GCP Project ID` that you want to enable the `Data Catalog API` on.
- Click on `Enable API` which will enable the data catalog api on the respective project.

### GCP Permissions

To execute metadata extraction and usage workflow successfully the user or the service account should have enough access to fetch required data. Following table describes the minimum required permissions

{% multiTablesWrapper %}

| #    | GCP Permission                | Required For            |
| :--- | :---------------------------- | :---------------------- |
| 1    | bigquery.datasets.get         | Metadata Ingestion      |
| 2    | bigquery.tables.get           | Metadata Ingestion      |
| 3    | bigquery.tables.getData       | Metadata Ingestion      |
| 4    | bigquery.tables.list          | Metadata Ingestion      |
| 5    | resourcemanager.projects.get  | Metadata Ingestion      |
| 6    | bigquery.jobs.create          | Metadata Ingestion      |
| 7    | bigquery.jobs.listAll         | Metadata Ingestion      |
| 8    | bigquery.routines.get         | Stored Procedure        |
| 9    | bigquery.routines.list        | Stored Procedure        |
| 10   | datacatalog.taxonomies.get    | Fetch Policy Tags       |
| 11   | datacatalog.taxonomies.list   | Fetch Policy Tags       |
| 12   | bigquery.readsessions.create  | Bigquery Usage & Lineage Workflow |
| 13   | bigquery.readsessions.getData | Bigquery Usage & Lineage Workflow |
| 14   | logging.operations.list       | Incremental Metadata Ingestion    |

{% /multiTablesWrapper %}

{% note %}
If the user has `External Tables`, please attach relevant permissions needed for external tables, alongwith the above list of permissions.
{% /note %}

{% note %}
If you are using BigQuery and have sharded tables, you might want to consider using partitioned tables instead. Partitioned tables allow you to efficiently query data by date or other criteria, without having to manage multiple tables. Partitioned tables also have lower storage and query costs than sharded tables. 
You can learn more about the benefits of partitioned tables [here](https://cloud.google.com/bigquery/docs/partitioned-tables#dt_partition_shard). 
If you want to convert your existing sharded tables to partitioned tables, you can follow the steps in this [guide](https://cloud.google.com/bigquery/docs/creating-partitioned-tables#convert-date-sharded-tables).
This will help you simplify your data management and optimize your performance in BigQuery.
{% /note %}

## Metadata Ingestion

{% partial
  file="/v1.8/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "BigQuery",
    selectServicePath: "/images/v1.8/connectors/bigquery/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/bigquery/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/bigquery/service-connection.png",
  }
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

**Host and Port**: BigQuery APIs URL. By default, the API URL is `bigquery.googleapis.com` you can modify this if you have custom implementation of BigQuery.

**GCP Credentials**: 
You can authenticate with your bigquery instance using either `GCP Credentials Path` where you can specify the file path of the service account key or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can check out [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.

**GCP Credentials Values**: Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:

- **Credentials type**: Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
- **Billing Project ID (Optional)**: A billing project ID is a unique string used to identify and authorize your project for billing in Google Cloud.
- **Project ID**: A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file. You can also pass multiple project id to ingest metadata from different BigQuery projects into one service.
- **Private Key ID**: This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
- **Private Key**: This is the private key associated with the service account that is used to authenticate and authorize access to BigQuery. To fetch this key, look for the value associated with the `private_key` key in the service account file.
- **Client Email**: This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
- **Client ID**: This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key  file.
- **Auth URI**: This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file. The default value to Auth URI is https://accounts.google.com/o/oauth2/auth.
- **Token URI**: The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization. To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file. Default Value to Token URI is https://oauth2.googleapis.com/token.
- **Authentication Provider X509 Certificate URL**: This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file. The Default value for Auth Provider X509Cert URL is https://www.googleapis.com/oauth2/v1/certs
- **Client X509Cert URL**: This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key  file.

**GCP Credentials Path**: Passing a local file path that contains the credentials.

**Taxonomy Project ID (Optional)**: Bigquery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how yo can create policy tags and set up column-level access control [here](https://cloud.google.com/bigquery/docs/column-level-security)

If you have attached policy tags to the columns of table available in Bigquery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the id of project in which the taxonomy was created.

**Taxonomy Location (Optional)**: Bigquery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how yo can create policy tags and set up column-level access control [here](https://cloud.google.com/bigquery/docs/column-level-security)

If you have attached policy tags to the columns of table available in Bigquery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the location/region in which the taxonomy was created.

**Usage Location (Optional)**:
Location used to query `INFORMATION_SCHEMA.JOBS_BY_PROJECT` to fetch usage data. You can pass multi-regions, such as `us` or `eu`, or your specific region such as `us-east1`. Australia and Asia multi-regions are not yet supported.

**Cost Per TiB (Optional)**:
The cost (in USD) per tebibyte (TiB) of data processed during BigQuery usage analysis. This value is used to estimate query costs when analyzing usage metrics from `INFORMATION_SCHEMA.JOBS_BY_PROJECT`.

This setting does **not** affect actual billing—it is only used for internal reporting and visualization of estimated costs.

The default value, if not set, may assume the standard on-demand BigQuery pricing (e.g., $5.00 per TiB), but you should adjust it according to your organization's negotiated rates or flat-rate pricing model.

{% note %}
If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for BigQuery you can just leave
the GCP credentials empty. This is why they are not marked as required.
{% /note %}


{% partial file="/v1.8/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

### Cross Project Lineage

We support cross-project lineage, but the data must be ingested within a single service. This means you need to perform lineage ingestion for just one service while including multiple projects.

{% collateContent %}
{% partial file="/v1.8/connectors/database/bigquery/reverse-metadata.md" /%}
{% /collateContent %}

{% partial file="/v1.8/connectors/database/related.md" /%}
