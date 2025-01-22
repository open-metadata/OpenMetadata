---
title: BigQuery
slug: /connectors/database/bigquery
---

{% connectorDetailsHeader
name="BigQuery"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "dbt", "Tags", "Stored Procedures"]
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

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/bigquery/yaml"} /%}

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/bigquery/connections) user credentials with the BigQuery connector.

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
  file="/v1.7/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "BigQuery",
    selectServicePath: "/images/v1.7/connectors/bigquery/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/bigquery/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/bigquery/service-connection.png",
  }
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

### Cross Project Lineage

We support cross-project lineage, but the data must be ingested within a single service. This means you need to perform lineage ingestion for just one service while including multiple projects.

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
