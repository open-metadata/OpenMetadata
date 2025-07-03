---
title: Domo Database Connector | OpenMetadata Integration Guide
<<<<<<< HEAD
description: Connect Domo Database to OpenMetadata with our comprehensive connector guide. Setup instructions, configuration steps, and metadata extraction made simple.
=======
description: Connect Domo Database to OpenMetadata with our comprehensive connector guide. Setup instructions, configuration steps, and metadata extraction tips.
>>>>>>> bd5955fca2 (Docs: SEO Description Updation (#22035))
slug: /connectors/database/domo-database
---

{% connectorDetailsHeader
name="Domo"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "Owners", "Tags", "Stored Procedures", "dbt", "Sample Data"]
/ %}

In this section, we provide guides and references to use the DomoDatabase connector.

Configure and schedule DomoDatabase metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/domo-database/troubleshoot)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/domo-database/yaml"} /%}

## Requirements

For metadata ingestion, make sure to add at least `data` scopes to the clientId provided.
For questions related to scopes, click [here](https://developer.domo.com/portal/1845fc11bbe5d-api-authentication).

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Domo Database", 
    selectServicePath: "/images/v1.7/connectors/domodatabase/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/domodatabase/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/domodatabase/service-connection.png",
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

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/database/related.md" /%}
