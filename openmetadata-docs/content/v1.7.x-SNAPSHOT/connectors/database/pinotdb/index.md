---
title: PinotDB
slug: /connectors/database/pinotdb
---

{% connectorDetailsHeader
name="PinotDB"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage", "View Column-level Lineage"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the PinotDB connector.

Configure and schedule PinotDB metadata and profiler workflows from the OpenMetadata UI:

- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Lineage](/how-to-guides/data-lineage/workflow)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/pinotdb/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/pinotdb/connections) user credentials with the PinotDB connector.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "PinotDB", 
    selectServicePath: "/images/v1.7/connectors/pinotdb/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/pinotdb/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/pinotdb/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
