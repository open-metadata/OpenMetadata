---
title: Impala
slug: /connectors/database/impala
---

{% connectorDetailsHeader
name="Impala"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage", "View Column-level Lineage"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Impala connector.

Configure and schedule Impala metadata and profiler workflows from the OpenMetadata UI:
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Lineage](/how-to-guides/data-lineage/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Enable Security](#securing-impala-connection-with-ssl-in-openmetadata)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/impala/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/impala/connections) user credentials with the Impala connector.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Impala", 
    selectServicePath: "/images/v1.7/connectors/impala/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/impala/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/impala/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Impala Connection with SSL in OpenMetadata

To configure SSL for secure connections between OpenMetadata and an Impala database, add the key `use_ssl` with a value of `true` to the `connectionArguments` to enable SSL. Additionally, include the key `ca_cert` with the path to the CA certificate file as its value. Ensure that the certificate file is accessible by the server, and if deploying via Docker or Kubernetes, update the CA certificate in the OpenMetadata server to reflect these changes.

{% image
  src="/images/v1.7/connectors/ssl_Impala.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
