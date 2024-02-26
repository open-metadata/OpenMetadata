---
title: SingleStore
slug: /connectors/database/singlestore
---

{% connectorDetailsHeader
name="Singlestore"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "dbt"]
unavailableFeatures=["Query Usage", "Stored Procedures", "Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Singlestore connector.

Configure and schedule Singlestore metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/singlestore/yaml"} /%}

## Requirements

### Metadata
To extract metadata the user used in the connection needs to have access to the `INFORMATION_SCHEMA`.  By default a user can see only the rows in the `INFORMATION_SCHEMA` that correspond to objects for which the user has the proper access privileges.

```SQL
-- Create user.
-- More details https://docs.singlestore.com/managed-service/en/reference/sql-reference/security-management-commands/create-user.html
CREATE USER <username>[@<hostName>] IDENTIFIED BY '<password>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a specific object
GRANT SELECT ON world.hello TO '<username>';
```

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/connectors/ingestion/workflows/profiler) and data quality tests [here](/connectors/ingestion/workflows/data-quality).

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Singlestore", 
    selectServicePath: "/images/v1.3/connectors/singlestore/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/singlestore/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/singlestore/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to SingleStore. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to SingleStore.
- **Host and Port**: Enter the fully qualified hostname and port number for your SingleStore deployment in the Host and Port field.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
