---
title: PinotDB
slug: /connectors/database/pinotdb
---

{% connectorDetailsHeader
name="PinotDB"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage", "View Column-level Lineage"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the PinotDB connector.

Configure and schedule PinotDB metadata and profiler workflows from the OpenMetadata UI:

- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/pinotdb/yaml"} /%}

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "PinotDB", 
    selectServicePath: "/images/v1.3/connectors/pinotdb/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/pinotdb/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/pinotdb/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to PinotDB. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to PinotDB.
- **Host and Port**: Enter the fully qualified hostname and port number for your PinotDB deployment in the Host and Port field.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **sslCA**: Provide the path to ssl ca file.
- **sslCert**: Provide the path to ssl client certificate file (ssl_cert).
- **sslKey**: Provide the path to ssl client certificate file (ssl_key).

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
