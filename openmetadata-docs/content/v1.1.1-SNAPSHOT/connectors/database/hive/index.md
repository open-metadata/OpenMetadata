---
title: Hive
slug: /connectors/database/hive
---

# Hive

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="cross" /%} |
| Data Profiler      | {% icon iconName="check" /%} |
| Data Quality       | {% icon iconName="check" /%} |
| Lineage            | Manual          |
| DBT                | {% icon iconName="cross" /%} |
| Supported Versions | Hive >= 2.0                         |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | Manual          |
| Table-level  | {% icon iconName="check" /%} |
| Column-level | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}


In this section, we provide guides and references to use the Hive connector.

Configure and schedule Hive metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.1.1/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/hive/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

### Metadata

To extract metadata, the user used in the connection needs to be able to perform `SELECT`, `SHOW`, and `DESCRIBE` operations in the database/schema where the metadata needs to be extracted from.

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/connectors/ingestion/workflows/profiler) and data quality tests [here](/connectors/ingestion/workflows/data-quality).

## Metadata Ingestion

{% partial 
  file="/v1.1.1/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Hive", 
    selectServicePath: "/images/v1.1.1/connectors/hive/select-service.png",
    addNewServicePath: "/images/v1.1.1/connectors/hive/add-new-service.png",
    serviceConnectionPath: "/images/v1.1.1/connectors/hive/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Hive. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Hive.
- **Host and Port**: Enter the fully qualified hostname and port number for your Hive deployment in the Host and Port field.
- **Auth Options (Optional)**: Enter the auth options string for hive connection.

{% partial file="/v1.1.1/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.1.1/connectors/test-connection.md" /%}

{% partial file="/v1.1.1/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.1.1/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.1.1/connectors/troubleshooting.md" /%}

{% partial file="/v1.1.1/connectors/database/related.md" /%}
