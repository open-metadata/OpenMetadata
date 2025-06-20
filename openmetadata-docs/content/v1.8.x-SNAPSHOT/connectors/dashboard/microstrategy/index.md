---
title: MicroStrategy Connector | OpenMetadata Integration Guide
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
- [Troubleshooting](/connectors/dashboard/microstrategy/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/microstrategy/yaml"} /%}

## Requirements

To integrate MicroStrategy, ensure you are using OpenMetadata version 1.2.x or higher.

When a service user is created, it is already provisioned with the necessary permissions.
However, if the user still cannot access the APIs, the following should be checked as part of the troubleshooting process:
- Required DSS Privileges for MicroStrategy REST/JSON API:
- Web Services API: Essential for REST API usage.
- Login to MicroStrategy: User authentication.
- Use Project Sources: Access to project sources.
- View Metadata: Metadata browsing and viewing.
- Access Administration Objects: Global metadata access (connections, DB instances).
- Browse Repository: Object navigation within projects/folders.

## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "MicroStrategy", 
    selectServicePath: "/images/v1.8/connectors/microstrategy/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/microstrategy/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/microstrategy/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to MicroStrategy, e.g., user@organization.com. This user should have access to relevant dashboards and charts in MicroStrategy to fetch the metadata.

- **Password**: Password of the user account to connect with MicroStrategy.

- **Host Port**: This parameter specifies the host of the MicroStrategy instance. This should be specified as a URI string in the format http://hostname or https://hostname.

For example, you might set it to https://demo.microstrategy.com.

- **Project Name**: The name of the project within MicroStrategy that OpenMetadata will connect to, linking to the relevant dashboards and reports for metadata retrieval.

- **Login Mode**: Login Mode for Microstrategy's REST API connection. You can authenticate with one of the following authentication modes: `Standard (1)`, `Anonymous (8)`. Default will be `Standard (1)`.
If you're using demo account for Microstrategy, it will be needed to authenticate through loginMode `8`.

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
