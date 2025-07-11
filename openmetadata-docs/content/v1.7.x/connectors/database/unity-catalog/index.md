---
title: Unity Catalog Connector | OpenMetadata Data Governance
description: Connect Unity Catalog to OpenMetadata seamlessly. Complete setup guide, configuration steps, and metadata extraction for Databricks Unity Catalog integration.
slug: /connectors/database/unity-catalog
---

{% connectorDetailsHeader
name="Unity Catalog"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Sample Data", "Reverse Metadata (Collate Only)", "Auto-Classification"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the Unity Catalog connector.

Configure and schedule Unity Catalog metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/unity-catalog/troubleshooting)
{% collateContent %}
- [Reverse Metadata](#reverse-metadata)
{% /collateContent %}

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/unity-catalog/yaml"} /%}

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the Unity Catalog ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[databricks]"
```
### Permission Requirement

To enable full functionality of metadata extraction, profiling, usage, and lineage features in OpenMetadata, the following permissions must be granted to the relevant users in your Databricks environment.

### Metadata and Profiling Permissions

These permissions are required on the catalogs, schemas, and tables from which metadata and profiling information will be ingested.

```sql
GRANT USE CATALOG ON CATALOG <catalog_name> TO `<user>`;
GRANT USE SCHEMA ON SCHEMA <schema_name> TO `<user>`;
GRANT SELECT ON TABLE <table_name> TO `<user>`;
```

Ensure these grants are applied to all relevant tables for metadata ingestion and profiling operations.

### Usage and Lineage

These permissions enable OpenMetadata to extract query history and construct lineage information.

```sql
GRANT SELECT ON SYSTEM.QUERY.HISTORY TO `<user>`;
GRANT USE SCHEMA ON SCHEMA system.query TO `<user>`;
```

These permissions allow access to Databricks system tables that track query activity, enabling lineage and usage statistics generation.

{% note %}

Adjust <user>, <catalog_name>, <schema_name>, and <table_name> according to your specific deployment and security requirements.

{% /note %}

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Unity Catalog", 
    selectServicePath: "/images/v1.7/connectors/unitycatalog/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/unitycatalog/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/unitycatalog/service-connection.png",
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

{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% collateContent %}
{% partial file="/v1.7/connectors/database/unitycatalog/reverse-metadata.md" /%}
{% /collateContent %}

{% partial file="/v1.7/connectors/database/related.md" /%}
