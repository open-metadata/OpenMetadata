---
title: DomoDatabase
slug: /connectors/database/domo-database
---

{% connectorDetailsHeader
name="Domo"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "Owners", "Tags", "Stored Procedures", "dbt"]
/ %}

In this section, we provide guides and references to use the DomoDatabase connector.

Configure and schedule DomoDatabase metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/domo-database/yaml"} /%}

## Requirements

For metadata ingestion, make sure to add at least `data` scopes to the clientId provided.
For questions related to scopes, click [here](https://developer.domo.com/portal/1845fc11bbe5d-api-authentication).

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Domo Database", 
    selectServicePath: "/images/v1.3/connectors/domodatabase/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/domodatabase/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/domodatabase/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Client ID**: Client ID for DOMO Database.
- **Secret Token**: Secret Token to Connect DOMO Database.
- **Access Token**: Access to Connect to DOMO Database.
- **Api Host**: API Host to Connect to DOMO Database instance.
- **Instance Domain**: URL to connect to your Domo instance UI. For example `https://<your>.domo.com`.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
