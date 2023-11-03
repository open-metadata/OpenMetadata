---
title: Domo-Pipeline
slug: /connectors/pipeline/domo-pipeline
---

# Domo Pipeline

In this section, we provide guides and references to use the Domo-Pipeline connector.

Configure and schedule Domo-Pipeline metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.1/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/domo-pipeline/yaml"} /%}

## Requirements

For metadata ingestion, make sure to add at least `data` scopes to the clientId provided.
For questions related to scopes, click [here](https://developer.domo.com/portal/1845fc11bbe5d-api-authentication).

## Metadata Ingestion

{% partial 
  file="/v1.1/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Domo Pipeline", 
    selectServicePath: "/images/v1.1/connectors/domopipeline/select-service.png",
    addNewServicePath: "/images/v1.1/connectors/domopipeline/add-new-service.png",
    serviceConnectionPath: "/images/v1.1/connectors/domopipeline/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Client ID**: Client Id for DOMO Pipeline.
- **Secret Token**: Secret Token to Connect to DOMO Pipeline.
- **Access Token**: Access to Connect to DOMO Pipeline.
- **API Host**: API Host to Connect to DOMO Pipeline.
- **SandBox Domain**: Connect to SandBox Domain.

{% /extraContent %}

{% partial file="/v1.1/connectors/test-connection.md" /%}

{% partial file="/v1.1/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.1/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.1/connectors/troubleshooting.md" /%}
