---
title: Presto Connector | OpenMetadata Distributed SQL Guide
<<<<<<< HEAD
<<<<<<< HEAD
description: Connect Presto databases to OpenMetadata with our comprehensive connector guide. Setup instructions, configuration examples, and metadata extraction tips.
=======
description: Connect Presto to OpenMetadata with our comprehensive database connector guide. Step-by-step setup, configuration, and metadata extraction for seamless integration.
>>>>>>> bd5955fca2 (Docs: SEO Description Updation (#22035))
=======
description: Connect Presto databases to OpenMetadata with our comprehensive connector guide. Setup instructions, configuration examples, and metadata extraction tips.
>>>>>>> ac8f18500f (Doc: Meta Description Updation)
slug: /connectors/database/presto
---

{% connectorDetailsHeader
name="Presto"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "Sample Data"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures", "Lineage", "Column-level Lineage"]
/ %}

In this section, we provide guides and references to use the Presto connector.

Configure and schedule Presto metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/presto/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/presto/yaml"} /%}

## Requirements

### Metadata

To extract metadata, the user needs to be able to perform `SHOW CATALOGS`, `SHOW TABLES`, and `SHOW COLUMNS FROM` on the catalogs/tables you wish to extract metadata from and have `SELECT` permission on the `INFORMATION_SCHEMA`. Access to resources will be different based on the connector used. You can find more details in the Presto documentation website [here](https://prestodb.io/docs/current/connector.html). You can also get more information regarding system access control in Presto [here](https://prestodb.io/docs/current/security/built-in-system-access-control.html).

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Presto", 
    selectServicePath: "/images/v1.7/connectors/presto/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/presto/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/presto/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

- **Username**: Specify the User to connect to Presto. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Presto.
- **Host and Port**: Enter the fully qualified hostname and port number for your Presto deployment in the Host and Port field.
- **Catalog**: Presto offers a catalog feature where all the databases are stored.
- **DatabaseSchema**: DatabaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/database/related.md" /%}
