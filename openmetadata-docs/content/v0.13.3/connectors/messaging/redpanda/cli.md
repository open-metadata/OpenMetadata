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

**bootstrapServers**: Redpanda bootstrap servers. 

Add them in comma separated values ex: host1:9092,host2:9092.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**schemaRegistryURL**: Confluent Redpanda Schema Registry URL. URI format.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**consumerConfig**: Confluent Redpanda Consumer Config.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**schemaRegistryConfig**:Confluent Redpanda Schema Registry Config.

**Note:** To ingest the topic schema `schemaRegistryURL` must be passed

{% /codeInfo %}




#### Source Configuration - Source Config

{% codeInfo srNumber=5 %}

The sourceConfig is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/messagingServiceMetadataPipeline.json):

**generateSampleData:** Option to turn on/off generating sample data during metadata extraction.

**topicFilterPattern:** Note that the `topicFilterPattern` supports regex as include or exclude.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=6 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=7 %}

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
      consumerConfig: {}
```
```yaml {% srNumber=4 %}
      schemaRegistryConfig: {}
```
```yaml {% srNumber=5 %}
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
```yaml {% srNumber=6 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=7 %}
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
