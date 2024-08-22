---
title: Dagster
slug: /connectors/pipeline/dagster
---

{% connectorDetailsHeader
name="Dagster"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Tags"]
unavailableFeatures=["Owners", "Lineage"]
/ %}


In this section, we provide guides and references to use the Dagster connector.

Configure and schedule Dagster metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
  - [Dagster Versions](#dagster-versions)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Details](#connection-details)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](#troubleshooting)
  - [Workflow Deployment Error](#workflow-deployment-error)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/dagster/yaml"} /%}

## Requirements

### Dagster Versions

OpenMetadata is integrated with dagster up to version [1.0.13](https://docs.dagster.io/getting-started) and will continue to work for future dagster versions.

The ingestion framework uses [dagster graphql python client](https://docs.dagster.io/_apidocs/libraries/dagster-graphql#dagster_graphql.DagsterGraphQLClient) to connect to the dagster instance and perform the API calls

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Dagster", 
    selectServicePath: "/images/v1.3/connectors/dagster/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/dagster/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/dagster/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host**: Host of the dagster eg.`https://localhost:300` or `https://127.0.0.1:3000` or `https://<yourorghere>.dagster.cloud/prod`
- **Token** : Need pass token if connecting to `dagster cloud` instance
  - Log in to your Dagster account.
  - Click on the "Settings" link in the top navigation bar.
  - Click on the "API Keys" tab.
  - Click on the "Create a New API Key" button.
  - Give your API key a name and click on the "Create API Key" button.
  - Copy the generated API key to your clipboard and paste it in the field.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
