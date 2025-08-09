---
title: CockroachDB Connector | `brandName` Integration Guide
description: Set up CockroachDB connector in `brandName` to discover, catalog, and manage your database metadata. Complete integration guide with configuration steps.
slug: /connectors/database/cockroach
---

{% connectorDetailsHeader
name="Cockroach"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Quality", "Data Profiler", "Auto-Classification"]
unavailableFeatures=["Query Usage", "dbt", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures"]
/ %}



In this section, we provide guides and references to use the Cockroach connector.

Configure and schedule Cockroach metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Troubleshooting](/connectors/database/cockroach/troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/cockroach/yaml"} /%}

## Requirements

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Cockroach", 
    selectServicePath: "/images/v1.9/connectors/cockroach/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/cockroach/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/cockroach/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}


#### Connection Details

- **Username**: Specify the User to connect to Cockroach. It should have enough privileges to read all the metadata.
- **Auth Type**: Basic Auth or IAM based auth to connect to instances / cloud rds.
  - **Basic Auth**: 
    - **Password**: Password to connect to Cockroach
  
- **Host and Port**: Enter the fully qualified hostname and port number for your Cockroach deployment in the Host and Port field.

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.9/connectors/database/related.md" /%}

**SSL Modes**

There are a couple of types of SSL modes that Cockroach supports which can be added to ConnectionArguments, they are as follows:
- **disable**: SSL is disabled and the connection is not encrypted.
- **allow**: SSL is used if the server requires it.
- **prefer**: SSL is used if the server supports it.
- **require**: SSL is required.
- **verify-ca**: SSL must be used and the server certificate must be verified.
- **verify-full**: SSL must be used. The server certificate must be verified, and the server hostname must match the hostname attribute on the certificate.

**SSL Configuration**

In order to integrate SSL in the Metadata Ingestion Config, the user will have to add the SSL config under sslConfig which is placed in the source.



## Securing Cockroach Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and a Cockroach database, you can configure SSL using different SSL modes provided by Cockroach, each offering varying levels of security.

Under `Advanced Config`, specify the SSL mode appropriate for your connection, such as `prefer`, `verify-ca`, `allow`, and others. After selecting the SSL mode, provide the CA certificate used for SSL validation (`caCertificate`). Note that Cockroach requires only the CA certificate for SSL validation.


{% /note %}

{% image
  src="/images/v1.6/connectors/ssl_connection.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.9/connectors/database/related.md" /%}
