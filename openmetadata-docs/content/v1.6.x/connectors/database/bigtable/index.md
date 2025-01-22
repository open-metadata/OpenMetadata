---
title: BigTable
slug: /connectors/database/bigtable
---

{% connectorDetailsHeader
name="BigTable"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "Owners", "dbt", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the BigTable connector.

Configure and schedule BigTable metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.6/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/bigtable/yaml"} /%}

{% partial file="/v1.6/connectors/external-ingestion-deployment.md" /%}

{%inlineCallout icon="description" bold="OpenMetadata 1.3.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/bigtable/connections) user credentials with the BigTable connector.

## Requirements

### BigTable Admin API Permissions 

- Go to [Cloud Bigtable Admin API in the GCP API Library](https://console.cloud.google.com/apis/library/bigtableadmin.googleapis.com)
- Select the `GCP Project ID`.
- Click on `Enable API` which will enable the data catalog api on the respective project.

### BigTable API Permissions 

- Go to [Cloud Bigtable API in the GCP API Library](https://console.cloud.google.com/apis/library/bigtable.googleapis.com)
- Select the `GCP Project ID`.
- Click on `Enable API` which will enable the data catalog api on the respective project.

### GCP Permissions

To execute metadata extraction workflow successfully the user or the service account should have enough access to fetch required data. Following table describes the minimum required permissions

{% multiTablesWrapper %}

| #    | GCP Permission                | Required For            |
| :--- | :---------------------------- | :---------------------- |
| 1    | bigtable.instances.get        | Metadata Ingestion      |
| 2    | bigtable.instances.list       | Metadata Ingestion      |
| 3    | bigtable.tables.get           | Metadata Ingestion      |
| 4    | bigtable.tables.list          | Metadata Ingestion      |
| 5    | bigtable.tables.readRows      | Metadata Ingestion      |

{% /multiTablesWrapper %}

{% tilesContainer %}
{% tile
icon="manage_accounts"
title="Create Custom GCP Role"
description="Checkout this documentation on how to create a custom role and assign it to the service account."
link="/connectors/database/bigtable/roles"
  / %}
{% /tilesContainer %}

## Metadata Ingestion

{% partial
  file="/v1.6/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "BigTable",
    selectServicePath: "/images/v1.6/connectors/bigtable/select-service.png",
    addNewServicePath: "/images/v1.6/connectors/bigtable/add-new-service.png",
    serviceConnectionPath: "/images/v1.6/connectors/bigtable/service-connection.png",
  }
/%}

{% stepsContainer %}

{% partial file="/v1.6/connectors/test-connection.md" /%}

{% partial file="/v1.6/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.6/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.6/connectors/troubleshooting.md" /%}
