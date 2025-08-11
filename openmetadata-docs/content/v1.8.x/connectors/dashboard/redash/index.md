---
title: Redash Connector | OpenMetadata Dashboard Integration
description: Connect Redash dashboards to OpenMetadata Easily. Complete setup guide, configuration steps, and integration instructions for seamless data lineage tracking.
slug: /connectors/dashboard/redash
---

{% connectorDetailsHeader
  name="Redash"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Lineage", "Owners", "Tags"]
  unavailableFeatures=["Datamodels", "Projects"]
/ %}


In this section, we provide guides and references to use the Redash connector.

Configure and schedule Redash metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Lineage](#lineage)
- [Troubleshooting](/connectors/dashboard/redash/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/redash/yaml"} /%}

## Requirements

We connect to Redash through the [API](https://redash.io/help/user-guide/integrations-and-api/api) endpoint, so the user
we use in the configuration to ingest data must have enough permissions to view all the data. For more info about the
permissions, please visit Redash documentation [here](https://redash.io/help/user-guide/users/permissions-groups).

## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Redash", 
    selectServicePath: "/images/v1.8/connectors/redash/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/redash/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/redash/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: URL to the Redash instance.
- **Username**: Specify the User to connect to Redash. It should have enough privileges to read all the metadata.
- **API Key**: API key of the redash instance to access. It has the same permissions as the user who owns it. Can be found on a user profile page.
- **Redash Version**: Redash version of your redash instance. Enter the numerical value from the [Redash Releases](https://github.com/getredash/redash/releases) page. Default: `10.0.0`.

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.8/connectors/dashboard/dashboard-lineage.md" /%}
