---
title: PinotDB Connector | OpenMetadata Real-Time Analytics Guide
description: Connect Apache Pinot to OpenMetadata with our comprehensive database connector guide. Setup instructions, configuration examples, and metadata extraction tips.
slug: /connectors/database/pinotdb
---

{% connectorDetailsHeader
name="PinotDB"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage", "View Column-level Lineage", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the PinotDB connector.

Configure and schedule PinotDB metadata and profiler workflows from the OpenMetadata UI:

- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Troubleshooting](/connectors/database/pinotdb/troubleshooting)

{% partial file="/v1.10/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/pinotdb/yaml"} /%}

## Metadata Ingestion

{% partial 
  file="/v1.10/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "PinotDB", 
    selectServicePath: "/images/v1.10/connectors/pinotdb/select-service.png",
    addNewServicePath: "/images/v1.10/connectors/pinotdb/add-new-service.png",
    serviceConnectionPath: "/images/v1.10/connectors/pinotdb/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to PinotDB. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to PinotDB.
- **Host and Port**: Enter the fully qualified hostname and port number for your PinotDB deployment in the Host and Port field.  Unlike broker host, prefix http:// or https:// must be added to controller host. For example, pinot broker host can be set to `localhost:8099` and pinot controller host can be set to `http://localhost:9000`.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **caCertificate**: Provide the path to ssl ca file.
- **sslCertificate**: Provide the path to ssl client certificate file (ssl_cert).
- **sslKey**: Provide the path to ssl client certificate file (ssl_key).

{% partial file="/v1.10/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.10/connectors/test-connection.md" /%}

{% partial file="/v1.10/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.10/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.10/connectors/database/related.md" /%}
