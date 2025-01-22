---
title: Greenplum
slug: /connectors/database/greenplum
---

{% connectorDetailsHeader
name="Greenplum"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures", "Lineage", "Column-level Lineage"]
/ %}

In this section, we provide guides and references to use the Greenplum connector.

Configure and schedule Greenplum metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Enable Security](#securing-greenplum-connection-with-ssl-in-openmetadata)

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/greenplum/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/greenplum/connections) user credentials with the Greenplum connector.

## Requirements

## Metadata Ingestion

{% partial 
  file="/v1.5/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Greenplum", 
    selectServicePath: "/images/v1.5/connectors/greenplum/select-service.png",
    addNewServicePath: "/images/v1.5/connectors/greenplum/add-new-service.png",
    serviceConnectionPath: "/images/v1.5/connectors/greenplum/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Greenplum Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and a Greenplum database, you can configure SSL using different SSL modes provided by Greenplum, each offering varying levels of security.

Under `Advanced Config`, specify the SSL mode appropriate for your connection, such as `prefer`, `verify-ca`, `allow`, and others. After selecting the SSL mode, provide the CA certificate used for SSL validation (`caCertificate`). Note that Greenplum requires only the CA certificate for SSL validation.

{% note %}

For IAM authentication, it is recommended to choose the `allow` mode or another SSL mode that fits your specific requirements.

{% /note %}

{% image
  src="/images/v1.5/connectors/ssl_connection.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.5/connectors/troubleshooting.md" /%}

{% partial file="/v1.5/connectors/database/related.md" /%}
