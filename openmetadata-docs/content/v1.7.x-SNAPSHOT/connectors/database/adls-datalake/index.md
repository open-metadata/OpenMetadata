---
title: ADLS Datalake
slug: /connectors/database/adls-datalake
---

{% connectorDetailsHeader
name="ADLS Datalake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Owners", "dbt", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the ADLS Datalake connector.

Configure and schedule Datalake metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/adls-datalake/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/adls-datalake/connections) user credentials with the Datalake connector.

## Requirements

{% note %}
The ADLS Datalake connector supports extracting metadata from file types `JSON`, `CSV`, `TSV` & `Parquet`.
{% /note %}

### ADLS Permissions

To extract metadata from Azure ADLS (Storage Account - StorageV2), you will need an **App Registration** with the following
permissions on the Storage Account:
- Storage Blob Data Contributor
- Storage Queue Data Contributor

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Datalake", 
    selectServicePath: "/images/v1.7/connectors/datalake/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/datalake/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/datalake/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
