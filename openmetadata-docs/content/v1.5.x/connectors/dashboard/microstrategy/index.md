---
title: MicroStrategy
slug: /connectors/dashboard/microstrategy
---

{% connectorDetailsHeader
  name="MicroStrategy"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Owners", "Datamodels", "Lineage"]
  unavailableFeatures=["Tags", "Projects"]
/ %}

In this section, we provide guides and references to use the MicroStrategy connector.

Configure and schedule MicroStrategy metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/microstrategy/yaml"} /%}

## Requirements

To integrate MicroStrategy, ensure you are using OpenMetadata version 1.2.x or higher.

## Metadata Ingestion

{% partial 
  file="/v1.5/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "MicroStrategy", 
    selectServicePath: "/images/v1.5/connectors/microstrategy/select-service.png",
    addNewServicePath: "/images/v1.5/connectors/microstrategy/add-new-service.png",
    serviceConnectionPath: "/images/v1.5/connectors/microstrategy/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to Mstr, e.g., user@organization.com. This user should have access to relevant dashboards and charts in Mstr to fetch the metadata.

- **Password**: Password of the user account to connect with Mstr.

- **Host Port**: This parameter specifies the host and port of the Mstr instance. This should be specified as a URI string in the format http://hostname:port or https://hostname:port.

For example, you might set it to https://org.mstr.com:3000.

- **Project Name**: The name of the project within Mstr that OpenMetadata will connect to, linking to the relevant dashboards and reports for metadata retrieval.

{% /extraContent %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.5/connectors/troubleshooting.md" /%}
