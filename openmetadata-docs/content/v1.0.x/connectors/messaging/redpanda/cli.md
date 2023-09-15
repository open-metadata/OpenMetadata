---
title: Run Redpanda Connector using the CLI
slug: /connectors/messaging/redpanda/cli
---

# Run Redpanda using the metadata CLI

In this section, we provide guides and references to use the Redpanda connector.

Configure and schedule Redpanda metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

### Python Requirements

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
following [link](https://docs.confluent.io/5.5.1/clients/confluent-kafka-python/index.html#confluent_kafka.schema_registry.SchemaRegistryClient).

**Note:** To ingest the topic schema, `schemaRegistryURL` must be passed.

{% /codeInfo %}

#### Source Configuration - Source Config

{% codeInfo srNumber=9 %}

The sourceConfig is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/messagingServiceMetadataPipeline.json):

**generateSampleData:** Option to turn on/off generating sample data during metadata extraction.

**topicFilterPattern:** Note that the `topicFilterPattern` supports regex as include or exclude.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=10 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=11 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
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
  sourceConfig:
    config:
      type: MessagingMetadata
      topicFilterPattern:
        excludes:
          - _confluent.*
      # includes:
      #   - topic1
      # generateSampleData: true
```
```yaml {% srNumber=10 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=11 %}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

{% /codeBlock %}

{% /codePreview %}

### Workflow Configs for Security Provider

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).

## Openmetadata JWT Auth

- JWT tokens will allow your clients to authenticate against the OpenMetadata server. To enable JWT Tokens, you will get more details [here](/deployment/security/enable-jwt-tokens).

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

- You can refer to the JWT Troubleshooting section [link](/deployment/security/jwt-troubleshooting) for any issues in your JWT configuration. If you need information on configuring the ingestion with other security providers in your bots, you can follow this doc [link](/deployment/security/workflow-config-auth).

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.
