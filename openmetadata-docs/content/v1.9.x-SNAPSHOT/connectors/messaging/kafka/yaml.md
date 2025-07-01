---
title: Run the Kafka Connector Externally
slug: /connectors/messaging/kafka/yaml
---

{% connectorDetailsHeader
name="Kafka"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Topics", "Sample Data"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Kafka connector.

Configure and schedule Kafka metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Enable Security](#securing-kafka-connection-with-ssl-in-openmetadata)

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.9/connectors/python-requirements.md" /%}

To run the Kafka ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[kafka]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/messaging/kafkaConnection.json)
you can find the structure to create a connection to Kafka.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Kafka:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**bootstrapServers**: List of brokers as comma separated values of broker `host` or `host:port`.

Example: `host1:9092,host2:9092`

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**schemaRegistryURL**: URL of the Schema Registry used to ingest the schemas of the topics.

If you encounter issues connecting to the Schema Registry, ensure that the protocol is explicitly specified in the Schema Registry URL. For example:
- Use `http://localhost:8081` instead of `localhost:8081`.
The Schema Registry requires a properly formatted URL, including the protocol (`http://` or `https://`). While this differentiation is expected in the Schema Registry configuration, it may not be immediately apparent.

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
{% /codeInfo %}

{% codeInfo srNumber=10 %}
**schemaRegistryTopicSuffixName**: Schema Registry Topic Suffix Name. The suffix to be appended to the topic name to get topic schema from registry.
{% /codeInfo %}

{% codeInfo srNumber=11 %}
**schemaRegistrySSL**: Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry connection.
{% /codeInfo %}

{% codeInfo srNumber=12 %}
**supportsMetadataExtraction**: Supports Metadata Extraction. `supportsMetadataExtraction` supports boolean value either true or false.
{% /codeInfo %}

{% partial file="/v1.9/connectors/yaml/messaging/source-config-def.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: kafka
  serviceName: local_kafka
  serviceConnection:
    config:
      type: Kafka
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
      # schemaRegistryTopicSuffixName: -value
```
```yaml {% srNumber=11 %}
      # schemaRegistrySSL: ""
```
```yaml {% srNumber=12 %}
      # supportsMetadataExtraction: true
```

{% partial file="/v1.9/connectors/yaml/messaging/source-config.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

## Securing Kafka Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and Kafka, in the `YAML` you can provide the CA certificate used for SSL validation by specifying the `caCertificate`. Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl key`, `ssl cert`, and `caCertificate`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `caCertificate` for the CA certificate to validate the server’s certificate.

```yaml
      sslConfig:
            caCertificate: "/path/to/ca_certificate"
            sslCertificate: "/path/to/your/ssl_cert"
            sslKey: "/path/to/your/ssl_key"
```

{% partial file="/v1.9/connectors/yaml/ingestion-cli.md" /%}
