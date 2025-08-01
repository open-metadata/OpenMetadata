---
title: Run the Redpanda Connector Externally
description: Use YAML to configure Redpanda metadata ingestion and track streaming data topics, schema evolution, and system events.
slug: /connectors/messaging/redpanda/yaml
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

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.9/connectors/python-requirements.md" /%}

To run the Redpanda ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[redpanda]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/messaging/redpandaConnection.json)
you can find the structure to create a connection to Redpanda.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Redpanda:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**bootstrapServers**: List of brokers as comma separated values of broker `host` or `host:port`.

Example: `host1:9092,host2:9092`

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**schemaRegistryURL**: URL of the Schema Registry used to ingest the schemas of the topics.

**NOTE**: For now, the schema will be the last version found for the schema name `{topic-name}-value`. An [issue](https://github.com/open-metadata/OpenMetadata/issues/10399) to improve how it currently works has been opened.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**saslUsername**: SASL username for use with the PLAIN and SASL-SCRAM mechanisms.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**saslPassword**: SASL password for use with the PLAIN and SASL-SCRAM mechanisms.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**saslMechanism**: SASL mechanism to use for authentication.

Supported: _GSSAPI, PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER_.

**NOTE**: Despite the name only one mechanism must be configured.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**basicAuthUserInfo**: Schema Registry Client HTTP credentials in the form of `username:password`.

By default, user info is extracted from the URL if present.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**consumerConfig**: The accepted additional values for the consumer configuration can be found in the following
[link](https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md).

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**schemaRegistryConfig**: The accepted additional values for the Schema Registry configuration can be found in the
following [link](https://docs.confluent.io/platform/current/clients/confluent-kafka-python/html/index.html#schemaregistryclient).

**Note:** To ingest the topic schema, `schemaRegistryURL` must be passed.

{% /codeInfo %}

{% codeInfo srNumber=9 %}
**securityProtocol**: security.protocol consumer config property. It accepts `PLAINTEXT`,`SASL_PLAINTEXT`, `SASL_SSL`, `SSL`.
{% /codeInfo}

{% codeInfo srNumber=10 %}
**supportsMetadataExtraction**: Supports Metadata Extraction. `supportsMetadataExtraction` supports boolean value either true or false.
{% /codeInfo %}

{% partial file="/v1.9/connectors/yaml/messaging/source-config-def.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: redpanda
  serviceName: local_redpanda
  serviceConnection:
    config:
      type: Redpanda
```
```yaml {% srNumber=1 %}
      bootstrapServers: localhost:9092
```
```yaml {% srNumber=2 %}
      schemaRegistryURL: http://localhost:8081  # Needs to be a URI
```
```yaml {% srNumber=3 %}
      saslUsername: username
```
```yaml {% srNumber=4 %}
      saslPassword: password
```
```yaml {% srNumber=5 %}
      saslMechanism: PLAIN
```
```yaml {% srNumber=6 %}
      basicAuthUserInfo: username:password
```
```yaml {% srNumber=7 %}
      consumerConfig: {}
```
```yaml {% srNumber=8 %}
      schemaRegistryConfig: {}
```
```yaml {% srNumber=9 %}  
      # securityProtocol: PLAINTEXT
```
```yaml {% srNumber=10 %}
      # supportsMetadataExtraction: true
```


{% partial file="/v1.9/connectors/yaml/messaging/source-config.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.9/connectors/yaml/ingestion-cli.md" /%}
