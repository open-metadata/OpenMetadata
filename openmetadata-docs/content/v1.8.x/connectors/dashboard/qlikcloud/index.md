---
title: Qlik Cloud Connector | OpenMetadata Dashboard Integration
slug: /connectors/dashboard/qlikcloud
---

{% connectorDetailsHeader
  name="Qlik Cloud"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Projects", "Dashboards", "Charts", "Datamodels", "Lineage", "Column Lineage"]
  unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Qlik Cloud connector.

Configure and schedule QlikCloud metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Lineage](#lineage)
- [Troubleshooting](/connectors/dashboard/qlikcloud/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/qlikcloud/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.1.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Metadata Ingestion

{% partial
  file="/v1.8/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "QlikCloud",
    selectServicePath: "/images/v1.8/connectors/qlikcloud/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/qlikcloud/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/qlikcloud/service-connection.png",
 }
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Qlik Cloud Host Port**: This field refers to the base url of your Qlik Cloud Portal, will be used for generating the redirect links for dashboards and charts. Example: `https://<TenantURL>.qlikcloud.com`
- **Qlik Cloud API Token**: Enter the API token for Qlik Cloud APIs access. Refer to [this](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-generate-api-keys.htm) document for more details about. Example: `eyJhbGciOiJFU***`.
- **Qlik Cloud Space Types**: Select relevant space types of Qlik Cloud to filter the dashboards ingested into the platform. Example: `Personal`, `Shared`, `Managed`, `Data`.

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.8/connectors/dashboard/dashboard-lineage.md" /%}
