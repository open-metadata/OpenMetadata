---
title: SQLite
slug: /connectors/database/sqlite
---

{% connectorDetailsHeader
name="SQLite"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "dbt"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Presto connector.

Configure and schedule Presto metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/sqlite/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/sqlite/connections) user credentials with the SQLite connector.

## Requirements

### Metadata

To extract metadata, the user needs to be able to perform `.tables`, `.schema`, on database you wish to extract metadata from and have `SELECT` permission on the `sqlite_temp_master`. Access to resources will be different based on the connector used.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SQLite", 
    selectServicePath: "/images/v1.7/connectors/sqlite/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/sqlite/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/sqlite/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
