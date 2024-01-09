---
title: Doris
slug: /connectors/database/doris
---

# Doris

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="cross" /%} |
| Data Profiler      | {% icon iconName="check" /%} |
| Data Quality       | {% icon iconName="check" /%} |
| Stored Procedures  | {% icon iconName="cross" /%} |
| DBT                | {% icon iconName="cross" /%} |
| Supported Versions | Metadata: Doris >= 1.2.0, Data Profiler: Doris >= 2.0.2 |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | Partially via Views          |
| Table-level  | {% icon iconName="cross" /%} |
| Column-level | {% icon iconName="cross" /%} |


{% /multiTablesWrapper %}

In this section, we provide guides and references to use the Doris connector.

Configure and schedule Doris metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.2/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/doris/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.2.x or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Metadata Ingestion

{% partial
file="/v1.2/connectors/metadata-ingestion-ui.md"
variables={
connector: "Doris",
selectServicePath: "/images/v1.2/connectors/doris/select-service.png",
addNewServicePath: "/images/v1.2/connectors/doris/add-new-service.png",
serviceConnectionPath: "/images/v1.2/connectors/doris/service-connection.png",
}
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Doris. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Doris.
- **Host and Port**: Enter the fully qualified hostname and port number for your Doris deployment in the Host and Port field.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **sslCA**: Provide the path to ssl ca file.
- **sslCert**: Provide the path to ssl client certificate file (ssl_cert).
- **sslKey**: Provide the path to ssl client certificate file (ssl_key).

{% partial file="/v1.2/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.2/connectors/test-connection.md" /%}

{% partial file="/v1.2/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.2/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.2/connectors/troubleshooting.md" /%}

{% partial file="/v1.2/connectors/database/related.md" /%}
