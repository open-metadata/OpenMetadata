---
title: Redpanda Connector | OpenMetadataMessaging Services
description: Connect OpenMetadata to Redpanda with our official messaging connector. Stream metadata, automate discovery, and integrate your Kafka-compatible platform seamlessly.
slug: /connectors/messaging/redpanda
---

{% connectorDetailsHeader
name="Redpanda"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Topics", "Sample Data"]
unavailableFeatures=[]
/ %}


In this section, we provide guides and references to use the Redpanda connector.

Configure and schedule Redpanda metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/messaging/redpanda/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/messaging/redpanda/yaml"} /%}

## Requirements

Connecting to Redpanda does not require any previous configuration.

The ingestion of the Kafka topics' schema is done separately by configuring the **Schema Registry URL**. However, only the **Bootstrap Servers** information is mandatory.

## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Redpanda", 
    selectServicePath: "/images/v1.8/connectors/redpanda/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/redpanda/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/redpanda/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Bootstrap Servers**: List of brokers as comma separated values of broker `host` or `host:port`. Example: `host1:9092,host2:9092`
- **Schema Registry URL**: URL of the Schema Registry used to ingest the schemas of the topics.
- **SASL Username**: SASL username for use with the PLAIN and SASL-SCRAM mechanisms.
- **SASL Password**: SASL password for use with the PLAIN and SASL-SCRAM mechanisms.
- **SASL Mechanism**: SASL mechanism to use for authentication.
- **Basic Auth User Info**: Schema Registry Client HTTP credentials in the form of `username:password`. By default, user info is extracted from the URL if present.
- **Consumer Config**: The accepted additional values for the consumer configuration can be found in the following [link](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md).
- **Schema Registry Config**: The accepted additional values for the Schema Registry configuration can be found in the following [link](https://docs.confluent.io/platform/current/clients/confluent-kafka-python/html/index.html#schemaregistryclient).

{% note %}
To ingest the topic schema `Schema Registry URL` must be passed
{% /note %}

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/messaging/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
