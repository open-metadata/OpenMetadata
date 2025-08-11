---
title: SQLite Connector | OpenMetadata Lightweight DB Integration
description: Learn to Configure OpenMetadata'sSQLite database connector for seamless data cataloging. Step-by-step setup guide with examples and troubleshooting tips.
slug: /connectors/database/sqlite
---

{% connectorDetailsHeader
name="SQLite"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "dbt", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Presto connector.

Configure and schedule Presto metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/sqlite/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/sqlite/yaml"} /%}

## Requirements

### Metadata

To extract metadata, the user needs to be able to perform `.tables`, `.schema`, on database you wish to extract metadata from and have `SELECT` permission on the `sqlite_temp_master`. Access to resources will be different based on the connector used.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SQLite", 
    selectServicePath: "/images/v1.7/connectors/sqlite/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/sqlite/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/sqlite/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to SQLite. Blank for in-memory database.
- **Password**: Password to connect to SQLite. Blank for in-memory database.
- **Host and Port**: Enter the fully qualified hostname and port number for your SQLite deployment in the Host and Port field.
- **Database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Database Mode**: How to run the SQLite database. :memory: by default.

{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/database/related.md" /%}
