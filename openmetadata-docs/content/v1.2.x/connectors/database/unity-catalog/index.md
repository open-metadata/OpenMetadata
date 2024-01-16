---
title: Unity Catalog
slug: /connectors/database/unity-catalog
---

# Unity Catalog

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="check" /%} |
| Data Profiler      | {% icon iconName="cross" /%} |
| Data Quality       | {% icon iconName="cross" /%} |
| Stored Procedures  | {% icon iconName="cross" /%} |
| Owners             | {% icon iconName="cross" /%} |
| Tags               | {% icon iconName="cross" /%} |
| DBT                | {% icon iconName="check" /%} |
| Supported Versions | Databricks Runtime Version 9+|

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | {% icon iconName="check" /%} |
| Table-level  | {% icon iconName="check" /%} |
| Column-level | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the Unity Catalog connector.

Configure and schedule Unity Catalog metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.2/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/unity-catalog/yaml"} /%}

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}


## Metadata Ingestion

{% partial 
  file="/v1.2/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Unity Catalog", 
    selectServicePath: "/images/v1.2/connectors/unitycatalog/select-service.png",
    addNewServicePath: "/images/v1.2/connectors/unitycatalog/add-new-service.png",
    serviceConnectionPath: "/images/v1.2/connectors/unitycatalog/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: Enter the fully qualified hostname and port number for your Databricks deployment in the Host and Port field.
- **Token**: Generated Token to connect to Databricks.
- **HTTP Path**: Databricks compute resources URL.
- **connectionTimeout**: The maximum amount of time (in seconds) to wait for a successful connection to the data source. If the connection attempt takes longer than this timeout period, an error will be returned.
- **Catalog**: Catalog of the data source(Example: hive_metastore). This is optional parameter, if you would like to restrict the metadata reading to a single catalog. When left blank, OpenMetadata Ingestion attempts to scan all the catalog.
- **DatabaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% partial file="/v1.2/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.2/connectors/test-connection.md" /%}

{% partial file="/v1.2/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.2/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.2/connectors/troubleshooting.md" /%}

{% partial file="/v1.2/connectors/database/related.md" /%}
