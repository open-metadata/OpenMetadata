---
title: Domo Pipeline | `brandName` Data Pipeline Services
description: Ingest metadata from Domo pipelines to capture ETL flows and integrate with governance and reporting tools.
slug: /connectors/pipeline/domo-pipeline
---

{% connectorDetailsHeader
name="Domo"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage", "Usage"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Domo-Pipeline connector.

Configure and schedule Domo-Pipeline metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/pipeline/domo-pipeline/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/domo-pipeline/yaml"} /%}

## Requirements

For metadata ingestion, make sure to add at least `data` scopes to the clientId provided.
For questions related to scopes, click [here](https://developer.domo.com/portal/1845fc11bbe5d-api-authentication).

## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Domo Pipeline", 
    selectServicePath: "/images/v1.8/connectors/domopipeline/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/domopipeline/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/domopipeline/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Client ID**: Client Id for DOMO Pipeline.
- **Secret Token**: Secret Token to Connect to DOMO Pipeline.
- **Access Token**: Access to Connect to DOMO Pipeline.
- **API Host**: API Host to Connect to DOMO Pipeline.
- **Instance Domain**: URL to connect to your Domo instance UI. For example `https://<your>.domo.com`.

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
