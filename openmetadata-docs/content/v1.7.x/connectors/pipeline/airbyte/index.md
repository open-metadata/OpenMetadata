---
title: Airbyte Connector | OpenMetadata Pipeline Integration
description: Connect Airbyte data pipelines to OpenMetadata for comprehensive data lineage tracking, metadata discovery, and pipeline monitoring. Setup guide included.
slug: /connectors/pipeline/airbyte
---

{% connectorDetailsHeader
name="Airbyte"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Airbyte connector.

Configure and schedule Airbyte metadata and profiler workflows from the OpenMetadata UI:

- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/pipeline/airbyte/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/airbyte/yaml"} /%}

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Airbyte", 
    selectServicePath: "/images/v1.7/connectors/airbyte/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/airbyte/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/airbyte/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: Pipeline Service Management UI URL

- **Username**: Username to connect to Airbyte.

- **Password**: Password to connect to Airbyte.

- **API Version**: Version of the Airbyte REST API by default `api/v1`.

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
