---
title: Apache Flink Connector | `brandName` Streaming Guide
description: Connect Apache Flink pipelines to `brandName` with our comprehensive connector guide. Step-by-step setup, configuration, and metadata extraction instructions.
slug: /connectors/pipeline/flink
---

{% connectorDetailsHeader
name="Flink"
stage="BETA"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Usage"]
unavailableFeatures=["Owners", "Tags", "Lineage"]
/ %}


In this section, we provide guides and references to use the Apache Flink connector.

Configure and schedule Flink metadata from the OpenMetadata UI:

- [Requirements](#requirements)
    - [Versions](#versions)
- [Metadata Ingestion](#metadata-ingestion)
    - [Service Name](#service-name)
    - [Connection Details](#connection-details)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](/connectors/pipeline/flink/troubleshooting)
    - [Workflow Deployment Error](#workflow-deployment-error)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/flink/yaml"} /%}

## Requirements

### Versions

OpenMetadata is integrated with flink up to version [1.19.0](https://nightlies.apache.org/flink/flink-docs-master/docs/dev/table/sql/gettingstarted/) and will continue to work for future flink versions.

The ingestion framework uses flink REST APIs to connect to the instance and perform the API calls

## Metadata Ingestion

{% partial 
    file="/v1.8/connectors/metadata-ingestion-ui.md" 
    variables={
        connector: "KafkaConnect", 
        selectServicePath: "/images/v1.8/connectors/flink/select-new-service.webp",
        addNewServicePath: "/images/v1.8/connectors/flink/add-new-service.webp",
        serviceConnectionPath: "/images/v1.8/connectors/flink/service-connection.webp",
    } 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: The hostname or IP address of the flink Connect worker with the REST API enabled eg.`http://localhost:8081` or `https://127.0.0.1:8081`.

- **Flink Connect Config**: OpenMetadata supports SSL config.
    1. SSL config
        - caCertificate: Authorized certificate for ssl configured server.
        - sslCertificate: SSL certificate for the server.
        - sslKey: Server root key for the connection.

- **verifySSL** : Whether SSL verification should be perform when authenticating.


{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
