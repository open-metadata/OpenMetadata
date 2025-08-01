---
title: Run the KafkaConnect Connector Externally
description: Set up Kafka Connect YAML configuration to stream metadata and schema updates from real-time Kafka topics into your catalog.
slug: /connectors/pipeline/kafkaconnect/yaml
---

{% connectorDetailsHeader
name="KafkaConnect"
stage="PROD"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Tags", "Usage"]
unavailableFeatures=["Owners", "Lineage"]
/ %}


In this section, we provide guides and references to use the KafkaConnect connector.

Configure and schedule KafkaConnect metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the KafkaConnect ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[kafkaconnect]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/kafkaConnectConnection.json)
you can find the structure to create a connection to KafkaConnect.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for KafkaConnect:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: The hostname or IP address of the Kafka Connect worker with the REST API enabled

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**verifySSL**: Whether SSL verification should be perform when authenticating.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Kafka Connect Config**: OpenMetadata supports username/password or no Authentication.

*Basic Authentication*
    - Username: Username to connect to Kafka Connect. This user should be able to send request to the Kafka Connect API and access the [Rest API](https://docs.confluent.io/platform/current/connect/references/restapi.html) GET endpoints.
    - Password: Password to connect to Kafka Connect. 

{% /codeInfo %}

{% codeInfo srNumber=4 %}
**messagingServiceName**: Name of the Kafka Messaging Service associated with this KafkaConnect Pipeline Service. e.g. local_kafka.
{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: kafkaconnect
  serviceName: kafka_connect_source
  serviceConnection:
    config:
      type: KafkaConnect
```
```yaml {% srNumber=1 %}
        hostPort: "https://<yourkafkaconnectresturihere>" # or http://localhost:8083 or http://127.0.0.1:8083
```
```yaml {% srNumber=2 %}
        verifySSL: true
```
```yaml {% srNumber=3 %}
        authType:
          username: username
          password: password
```
```yaml {% srNumber=4 %}
        # messagingServiceName: ""
```

{% partial file="/v1.8/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}
