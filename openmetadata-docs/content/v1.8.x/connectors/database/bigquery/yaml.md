---
title: Run the BigQuery Connector Externally
slug: /connectors/database/bigquery/yaml
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
- [Query Usage](#query-usage)
- [Lineage](#lineage)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)
{% collateContent %}
- [Reverse Metadata](/connectors/ingestion/workflows/reverse-metadata)
{% /collateContent %}

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the BigQuery ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[bigquery]"
```

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

{% /multiTablesWrapper %}

{% note %}
If the user has `External Tables`, please attach relevant permissions needed for external tables, alongwith the above list of permissions.
{% /note %}

{% tilesContainer %}
{% tile
icon="manage_accounts"
title="Create Custom GCP Role"
description="Checkout this documentation on how to create a custom role and assign it to the service account."
link="/connectors/database/bigquery/create-credentials"
  / %}
{% /tilesContainer %}

{% partial file="/v1.8/connectors/database/partitioned-tables.md" /%}

## Metadata Ingestion

### 1. Define the YAML Config

This is a sample config for BigQuery:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: BigQuery APIs URL. By default the API URL is `bigquery.googleapis.com` you can modify this if you have custom implementation of BigQuery.

**credentials**: 
You can authenticate with your bigquery instance using either `GCP Credentials Path` where you can specify the file path of the service account key or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.



**gcpConfig:**

**1.** Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/common/gcp-config-def.md" /%}

{% codeInfo srNumber=4 %}

**2.**  Passing a local file path that contains the credentials:
  - **gcpCredentialsPath**

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

- If you prefer to pass the credentials file, you can do so as follows:
```yaml
credentials:
  gcpConfig: 
    path: <path to file>
```

- If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for BigQuery you can just leave
the GCP credentials empty. This is why they are not marked as required.

```yaml
...
  config:
    type: BigQuery
    credentials:
      gcpConfig: {}
...
```

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**Billing Project ID (Optional)**: A billing project ID is a unique string used to identify and authorize your project for billing in Google Cloud.

{% /codeInfo %}


{% partial file="/v1.8/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=2 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: bigquery
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: BigQuery
```
```yaml {% srNumber=1 %}
      credentials:
        gcpConfig:
```

{% partial file="/v1.8/connectors/yaml/common/gcp-config.md" /%}

```yaml {% srNumber=4 %}
      # taxonomyLocation: us
      # taxonomyProjectID: ["project-id-1", "project-id-2"]
      # usageLocation: us
```
```yaml {% srNumber=5 %}
      # billingProjectId: project-id-1
```
```yaml {% srNumber=2 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=3 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.8/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.8/connectors/yaml/query-usage.md" variables={connector: "bigquery"} /%}

{% partial file="/v1.8/connectors/yaml/lineage.md" variables={connector: "bigquery"} /%}

{% partial file="/v1.8/connectors/yaml/data-profiler.md" variables={connector: "bigquery"} /%}

{% partial file="/v1.8/connectors/yaml/auto-classification.md" variables={connector: "bigquery"} /%}

{% partial file="/v1.8/connectors/yaml/data-quality.md" /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
