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
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/databricks/yaml"} /%}

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Unity Catalog

If you are using unity catalog in Databricks, then checkout the [Unity Catalog](/connectors/database/unity-catalog) connector.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Databricks", 
    selectServicePath: "/images/v1.3/connectors/databricks/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/databricks/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/databricks/service-connection.png",
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

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
