---
title: Exasol Connector | OpenMetadata High-Performance Database
slug: /connectors/database/exasol
---

{% connectorDetailsHeader
name="Exasol"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "Owners", "dbt", "Tags", "Stored Procedures", "Sample Data"]
/ %}


In this section, we provide guides and references for using the Exasol connector.

Configure and schedule Exasol metadata from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/database/exasol/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/exasol/yaml"} /%}

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

{%inlineCallout icon="description" bold="OpenMetadata 1.6.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Requirements

The connector requires **Exasol version 7.1 or higher** to function correctly. Ensure your Exasol instance meets this minimum version requirement before proceeding.

## Metadata Ingestion

{% partial
  file="/v1.7/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "Exasol",
    selectServicePath: "/images/v1.7/connectors/exasol/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/exasol/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/exasol/service-connection.png",
  }
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

### Connection Options

**Connection Scheme**: Specifies the SQLAlchemy driver scheme options required to connect to Exasol.

**Username**: The username used to connect to the Exasol database. Ensure that this user has sufficient privileges to read all the metadata from Exasol.

**Password**: The password associated with the user connecting to Exasol.

**Host and Port**: Defines the host and port of the Exasol instance. Provide this as a string in the format `hostname:port`. For example: `localhost:8563`
- If running the OpenMetadata ingestion in a Docker container and your services are hosted on `localhost`, use `host.docker.internal:8563`.

**SSL/TLS Settings**: Specifies the mode or settings for SSL/TLS validation during the connection. Available options:

**validate-certificate (Default)**: Enables Transport Layer Security (TLS) and validates the server certificate using system certificate stores.

**ignore-certificate**: Enables Transport Layer Security (TLS) but disables validation of the server certificate. 

{% note %}
- This mode should not be used in production. It is useful for testing with self-signed certificates.
{% /note %}

**disable-tls**: Disables Transport Layer Security (TLS). Data is sent in plain text (no encryption).
[!WARNING]
This mode is not recommended for production and should only be used in debugging scenarios.

{% note %}
Ensure that the appropriate TLS setting is chosen based on your security and deployment requirements.
{% /note %}

{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
