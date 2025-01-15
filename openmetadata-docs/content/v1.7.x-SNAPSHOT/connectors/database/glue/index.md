---
title: Glue
slug: /connectors/database/glue
---

{% connectorDetailsHeader
name="Glue"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "dbt"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage"]
/ %}


In this section, we provide guides and references to use the Glue connector.

Configure and schedule Glue metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/glue/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/glue/connections) user credentials with the Glue connector.

## Requirements

User must have `glue:GetDatabases` and `glue:GetTables` permissions to ingest the basic metadata.

## Metadata Ingestion

{% partial
file="/v1.7/connectors/metadata-ingestion-ui.md"
variables={
connector: "Glue",
selectServicePath: "/images/v1.7/connectors/glue/select-service.png",
addNewServicePath: "/images/v1.7/connectors/glue/add-new-service.png",
serviceConnectionPath: "/images/v1.7/connectors/glue/service-connection.png",
}
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
