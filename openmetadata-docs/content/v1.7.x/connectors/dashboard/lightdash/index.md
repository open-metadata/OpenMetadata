---
title: Lightdash Connector | OpenMetadata Dashboard Integration
slug: /connectors/dashboard/lightdash
---

{% connectorDetailsHeader
  name="Lightdash"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Owners", "Datamodels", "Lineage"]
  unavailableFeatures=["Tags", "Projects"]
/ %}

In this section, we provide guides and references to use the Lightdash connector.

Configure and schedule Lightdash metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Lineage](#lineage)
- [Troubleshooting](/connectors/dashboard/lightdash/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/lightdash/yaml"} /%}

## Requirements

To integrate Lightdash, ensure you are using OpenMetadata version 1.2.x or higher.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Lightdash", 
    selectServicePath: "/images/v1.7/connectors/lightdash/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/lightdash/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/lightdash/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details


- **Host and Port**: Specify the network location where your Lightdash instance is accessible, combining both hostname and port in a URI format: either `http://hostname:port` or `https://hostname:port`, based on your security needs.

   - **Example**: For a local setup, use `http://localhost:8080`; for a server deployment, it might be `https://lightdash.example.com:3000`.
   - Ensure the specified port is open and accessible through network firewall settings.

- **API Key**: This key authenticates requests to your Lightdash instance. Keep the API Key secure, sharing it only with authorized applications or users.

- **Project UUID**: This unique identifier links API requests or configurations to a specific project in Lightdash. 

- **Space UUID**: Identifies a specific "Space" in Lightdash, used to organize dashboards, charts, and assets.

- **Proxy Authentication**: If your Lightdash instance requires authentication through a proxy server, provide proxy credentials. Proxy authentication controls access to external resources and Lightdash.

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/dashboard/dashboard-lineage.md" /%}
