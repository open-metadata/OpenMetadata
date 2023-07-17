---
title: Qlik Sense
slug: /connectors/dashboard/qliksense
---

# Metabase

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="cross" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="check" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the Qlik Sense connector.

Configure and schedule Metabase metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.1.1/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/qliksense/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.1.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Metadata Ingestion

{% partial 
  file="/v1.1.1/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Metabase", 
    selectServicePath: "/images/v1.1.1/connectors/metabase/select-service.png",
    addNewServicePath: "/images/v1.1.1/connectors/metabase/add-new-service.png",
    serviceConnectionPath: "/images/v1.1.1/connectors/metabase/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Qlik Sense Base URL**: This field refers to the base url of your Qlik Sense Portal, will be used for generating the redirect links for dashboards and charts. Example: `https://server.domain.com` or `https://server.domain.com/<proxy-path>`
- **Qlik Engine JSON API Websocket URL**: Enter the websocket url of Qlik Sense Engine JSON API. Refer to [this](https://help.qlik.com/en-US/sense-developer/May2023/Subsystems/EngineAPI/Content/Sense_EngineAPI/GettingStarted/connecting-to-engine-api.htm) document for more details about. Example: `wss://server.domain.com:4747` or `wss://server.domain.com[/virtual proxy]`.
- **Password**: Password of the user account to connect with Metabase.

{% /extraContent %}

{% partial file="/v1.1.1/connectors/test-connection.md" /%}

{% partial file="/v1.1.1/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.1.1/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.1.1/connectors/troubleshooting.md" /%}
