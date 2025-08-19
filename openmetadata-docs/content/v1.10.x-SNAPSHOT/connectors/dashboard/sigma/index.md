---
title: Sigma Connector | OpenMetadata Dashboard Integration Guide
description: Connect Sigma Analytics to OpenMetadata seamlessly. Learn how to configure the Sigma dashboard connector for automated metadata extraction and lineage tracking.
slug: /connectors/dashboard/sigma
---

{% connectorDetailsHeader
  name="Sigma"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Lineage", "Owners"]
  unavailableFeatures=["Tags", "Datamodels", "Projects"]
/ %}

In this section, we provide guides and references to use the Sigma connector.

Configure and schedule Sigma metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Lineage](#lineage)
- [Troubleshooting](/connectors/dashboard/sigma/troubleshooting)

{% partial file="/v1.10/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/sigma/yaml"} /%}

## Requirements

OpenMetadata relies on Sigma's REST API. To know more you can read the [Sigma API Get Started docs](https://help.sigmacomputing.com/reference/get-started-sigma-api#about-the-api). To [generate API client credentials](https://help.sigmacomputing.com/reference/generate-client-credentials#user-requirements), you must be assigned the Admin account type.

## Metadata Ingestion

{% partial 
  file="/v1.10/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Sigma", 
    selectServicePath: "/images/v1.10/connectors/sigma/select-service.png",
    addNewServicePath: "/images/v1.10/connectors/sigma/add-new-service.png",
    serviceConnectionPath: "/images/v1.10/connectors/sigma/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

**hostPort**: Host and Port Sigma REST API.
The hostPort parameter specifies the host and port of the Sigma's API request URL. This should be specified as a string in the format `https://aws-api.sigmacomputing.com`. Sigma's API request URL varies according to the sigma cloud. you can determine your API url by following the docs [here](https://help.sigmacomputing.com/reference/get-started-sigma-api#identify-your-api-request-url)

**clientId**: Client Id for Sigma REST API.
Get the Client Id and client Secret by following below steps:
- Navigate to your Sigma homepage.
- Click on Administration in the lower left corner.
- Click on Developer Access on the left side.
- To generate a new Client Id and client Secret, On upper left corner click `Create New`.
- Enter the required details asked and click `Create`.
- Copy the generated access token and password.

For detailed information visit [here](https://help.sigmacomputing.com/reference/generate-client-credentials#generate-api-client-credentials).

**clientSecret**: Client Secret for Sigma REST API.
Copy the access token password from the step above where a new token is generated.

For detailed information visit [here](https://help.sigmacomputing.com/reference/generate-client-credentials#generate-api-client-credentials).

**apiVersion**: Sigma REST API Version.
Version of the Sigma REST API by default `v2`.

To get to know the Sigma REST API Version visit [here](https://help.sigmacomputing.com/reference/get-started-sigma-api#identify-your-api-request-url) and look into the `Token URL` section.

{% /extraContent %}

{% partial file="/v1.10/connectors/test-connection.md" /%}

{% partial file="/v1.10/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.10/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.10/connectors/dashboard/dashboard-lineage.md" /%}
