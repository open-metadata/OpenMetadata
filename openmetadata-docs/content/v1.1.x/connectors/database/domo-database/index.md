---
title: DomoDatabase
slug: /connectors/database/domo-database
---

# Domo Database

{% multiTablesWrapper %}

| Feature            | Status                       |
|:-------------------|:-----------------------------|
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="cross" /%} |
| Data Profiler      | {% icon iconName="cross" /%} |
| Data Quality       | {% icon iconName="cross" /%} |
| Lineage            | {% icon iconName="cross" /%} |
| DBT                | {% icon iconName="cross" /%} |
| Supported Versions | --                           |

| Feature      | Status                       |
|:-------------|:-----------------------------|
| Lineage      | {% icon iconName="cross" /%} |
| Table-level  | {% icon iconName="cross" /%} |
| Column-level | {% icon iconName="cross" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the DomoDatabase connector.

Configure and schedule DomoDatabase metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.1/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/domo-database/yaml"} /%}

## Requirements

For metadata ingestion, make sure to add at least `data` scopes to the clientId provided.
For questions related to scopes, click [here](https://developer.domo.com/portal/1845fc11bbe5d-api-authentication).

## Metadata Ingestion

{% partial 
  file="/v1.1/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Domo Database", 
    selectServicePath: "/images/v1.1/connectors/domodatabase/select-service.png",
    addNewServicePath: "/images/v1.1/connectors/domodatabase/add-new-service.png",
    serviceConnectionPath: "/images/v1.1/connectors/domodatabase/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Client ID**: Client ID for DOMO Database.
- **Secret Token**: Secret Token to Connect DOMO Database.
- **Access Token**: Access to Connect to DOMO Database.
- **Api Host**: API Host to Connect to DOMO Database instance.
- **SandBox Domain**: Connect to SandBox Domain.

{% /extraContent %}

{% partial file="/v1.1/connectors/test-connection.md" /%}

{% partial file="/v1.1/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.1/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.1/connectors/troubleshooting.md" /%}

{% partial file="/v1.1/connectors/database/related.md" /%}
