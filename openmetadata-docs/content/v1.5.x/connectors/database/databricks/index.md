---
title: Databricks
slug: /connectors/database/databricks
---

{% connectorDetailsHeader
name="Databricks"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "dbt", "Tags"]
unavailableFeatures=["Owners", "Stored Procedures"]
/ %}

{% note %}
As per the [documentation](https://docs.databricks.com/en/data-governance/unity-catalog/tags.html#manage-tags-with-sql-commands) here, note that we only support metadata `tag` extraction for databricks version 13.3 version and higher.
{% /note %}


In this section, we provide guides and references to use the Databricks connector.

Configure and schedule Databricks metadata and profiler workflows from the OpenMetadata UI:

- [Unity Catalog](#unity-catalog)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/databricks/yaml"} /%}

{% partial file="/v1.5/connectors/external-ingestion-deployment.md" /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/databricks/connections) user credentials with the Databricks connector.

## Unity Catalog

If you are using unity catalog in Databricks, then checkout the [Unity Catalog](/connectors/database/unity-catalog) connector.

## Metadata Ingestion

{% partial 
  file="/v1.5/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Databricks", 
    selectServicePath: "/images/v1.5/connectors/databricks/select-service.png",
    addNewServicePath: "/images/v1.5/connectors/databricks/add-new-service.png",
    serviceConnectionPath: "/images/v1.5/connectors/databricks/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.5/connectors/troubleshooting.md" /%}

{% partial file="/v1.5/connectors/database/related.md" /%}
