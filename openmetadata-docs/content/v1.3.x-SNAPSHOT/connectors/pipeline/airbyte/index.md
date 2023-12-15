---
title: Airbyte
slug: /connectors/pipeline/airbyte
---

# Airbyte

In this section, we provide guides and references to use the Airbyte connector.

Configure and schedule Airbyte metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/airbyte/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides. 
{% /inlineCallout %}

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Airbyte", 
    selectServicePath: "/images/v1.3/connectors/airbyte/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/airbyte/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/airbyte/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: Pipeline Service Management UI URL

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
