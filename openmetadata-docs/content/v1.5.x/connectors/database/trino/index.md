---
title: Trino
slug: /connectors/database/trino
---

{% connectorDetailsHeader
name="Trino"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Trino connector.

Configure and schedule Trino metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/trino/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/trino/connections) user credentials with the Trino connector.

## Requirements

### Metadata

To extract metadata, the user needs to be able to have `SELECT` privilege on all the tables that you would like to ingest in OpenMetadata as well as `SELECT` privilege `system.metadata.table_comments` table.

Access to resources will be based on the user access permission to access specific data sources. More information regarding access and security can be found in the Trino documentation [here](https://trino.io/docs/current/security.html).

### Profiler & Data Quality

Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion
{% partial 
  file="/v1.5/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Trino", 
    selectServicePath: "/images/v1.5/connectors/trino/select-service.png",
    addNewServicePath: "/images/v1.5/connectors/trino/add-new-service.png",
    serviceConnectionPath: "/images/v1.5/connectors/trino/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.5/connectors/troubleshooting.md" /%}

{% partial file="/v1.5/connectors/database/related.md" /%}
