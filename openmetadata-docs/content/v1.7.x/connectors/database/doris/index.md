---
title: Doris Connector | OpenMetadata Database Integration Guide
description: Connect Apache Doris to OpenMetadata with our comprehensive database connector guide. Setup instructions, configuration steps, and metadata extraction tips.
slug: /connectors/database/doris
---

{% connectorDetailsHeader
name="Doris"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Doris connector.

Configure and schedule Doris metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Enable Security](#securing-doris-connection-with-ssl-in-openmetadata)
- [Troubleshooting](/connectors/database/doris/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/doris/yaml"} /%}

## Requirements

Metadata: Doris >= 1.2.0, Data Profiler: Doris >= 2.0.2

## Metadata Ingestion

{% partial
file="/v1.7/connectors/metadata-ingestion-ui.md"
variables={
connector: "Doris",
selectServicePath: "/images/v1.7/connectors/doris/select-service.png",
addNewServicePath: "/images/v1.7/connectors/doris/add-new-service.png",
serviceConnectionPath: "/images/v1.7/connectors/doris/service-connection.png",
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
- **caCertificate**: Provide the path to ssl ca file.
- **sslCertificate**: Provide the path to ssl client certificate file (ssl_cert).
- **sslKey**: Provide the path to ssl client certificate file (ssl_key).

{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Doris Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and Doris, navigate to the `Advanced Config` section. Here, you can provide the CA certificate used for SSL validation by specifying the `caCertificate`. Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl_key`, `ssl_cert`, and `ssl_ca`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `ssl_ca` for the CA certificate to validate the server’s certificate.

{% image
  src="/images/v1.7/connectors/ssl_connection.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
