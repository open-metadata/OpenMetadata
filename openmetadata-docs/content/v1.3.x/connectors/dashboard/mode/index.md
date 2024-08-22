---
title: Mode
slug: /connectors/dashboard/mode
---

{% connectorDetailsHeader
  name="Mode"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Lineage"]
  unavailableFeatures=["Owners", "Tags", "Datamodels", "Projects"]
/ %}

In this section, we provide guides and references to use the Mode connector.

Configure and schedule Mode metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/mode/yaml"} /%}

## Requirements

OpenMetadata relies on Mode's API, which is exclusive to members of the Mode Business Workspace. This means that only resources that belong to a Mode Business Workspace can be accessed via the API.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Mode", 
    selectServicePath: "/images/v1.3/connectors/mode/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/mode/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/mode/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

**hostPort**: Host and Port Mode Dashboard.
The hostPort parameter specifies the host and port of the Mode server. This should be specified as a string in the format `https://app.mode.com`.

**accessToken**: Access Token for Mode Dashboard.
Get the Access Token by following below steps:
- Navigate to your Mode homepage.
- Click on your name in the upper left corner and click My Account.
- Click on API Tokens on the left side.
- To generate a new API token and password, enter a token name and click `Create token`.
- Copy the generated access token and password.

For detailed information visit [here](https://mode.com/developer/api-reference/introduction/).

**accessTokenPassword**: Access Token Password for Mode Dashboard.
Copy the access token password from the step above where a new token is generated.

For detailed information visit [here](https://mode.com/developer/api-reference/introduction/).

**workspaceName**: Mode Workspace Name.
Name of the mode workspace from where the metadata is to be fetched.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
