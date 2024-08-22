---
title: Fivetran
slug: /connectors/pipeline/fivetran
---

{% connectorDetailsHeader
name="Fivetran"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Fivetran connector.

Configure and schedule Fivetran metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/fivetran/yaml"} /%}

## Requirements

To access Fivetran APIs, a Fivetran account on a Standard, Enterprise, or Business Critical plan is required.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Fivetran", 
    selectServicePath: "/images/v1.3/connectors/fivetran/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/fivetran/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/fivetran/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

**apiKey**: Fivetran API Key.

Follow the steps mentioned below to generate the Fivetran API key and API secret:
- Click your user name in your Fivetran dashboard.
- Click API Key.
- Click Generate API key. (If you already have an API key, then the button text is Generate new API key.)
- Make a note of the key and secret as they won't be displayed once you close the page or navigate away.

For more detailed documentation visit [here](https://fivetran.com/docs/rest-api/getting-started).

- **apiSecret**: Fivetran API Secret. From the above step where the API key is generated copy the API secret
- **hostPort**: HostPort of the Fivetran instance. By default, OpenMetadata will use `https://api.fivetran.com` to connect to the Fivetran APIs.
- **limit**: Fivetran API Limit For Pagination. This refers to the maximum number of records that can be returned in a single page of results when using Fivetran's API for pagination.

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
