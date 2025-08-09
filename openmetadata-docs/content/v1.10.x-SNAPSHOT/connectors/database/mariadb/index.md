---
title: MariaDB Connector | `brandName` Database Integration Guide
description: Connect MariaDB to `brandName` with our comprehensive database connector guide. Easy setup, configuration steps, and metadata extraction for your data catalog.
slug: /connectors/database/mariadb
---

{% connectorDetailsHeader
name="MariaDB"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage", "View Column-level Lineage", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the MariaDB connector.

Configure and schedule MariaDB metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/mariadb/troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/mariadb/yaml"} /%}

## Requirements

### Metadata
To extract metadata the user used in the connection needs to have access to the `INFORMATION_SCHEMA`. By default a user can see only the rows in the `INFORMATION_SCHEMA` that correspond to objects for which the user has the proper access privileges.

```SQL
-- Create user. More details https://mariadb.com/kb/en/create-user/
CREATE USER <username>[@<hostName>] IDENTIFIED BY '<password>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a specific object
GRANT SELECT ON world.hello TO '<username>';
```

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "MariaDB", 
    selectServicePath: "/images/v1.9/connectors/mariadb/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/mariadb/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/mariadb/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to MariaDB. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to MariaDB.
- **Host and Port**: Enter the fully qualified hostname and port number for your MariaDB deployment in the Host and Port field.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.9/connectors/database/related.md" /%}
