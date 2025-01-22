---
title: Unity Catalog
slug: /connectors/database/unity-catalog
---

{% connectorDetailsHeader
name="Unity Catalog"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the Unity Catalog connector.

Configure and schedule Unity Catalog metadata workflow from the OpenMetadata UI:

- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.6/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/unity-catalog/yaml"} /%}

{% partial file="/v1.6/connectors/external-ingestion-deployment.md" /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/unity-catalog/connections) user credentials with the Unity Catalog connector.

## Metadata Ingestion

{% partial 
  file="/v1.6/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Unity Catalog", 
    selectServicePath: "/images/v1.6/connectors/unitycatalog/select-service.png",
    addNewServicePath: "/images/v1.6/connectors/unitycatalog/add-new-service.png",
    serviceConnectionPath: "/images/v1.6/connectors/unitycatalog/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.6/connectors/test-connection.md" /%}

{% partial file="/v1.6/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.6/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.6/connectors/troubleshooting.md" /%}

{% partial file="/v1.6/connectors/database/related.md" /%}
