---
title: Run the Amundsen Connector Externally
slug: /connectors/metadata/amundsen/yaml
---

{% connectorDetailsHeader
name="Amundsen"
stage="PROD"
platform="OpenMetadata"
availableFeatures=[]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Amundsen connector.

Configure and schedule Amundsen metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)


{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

Before this, you must create the service you want to get metadata for.  
You can learn how to do it by folowing the initial part of the Connector documentation for the service.
You can find the connectors list [here](/connectors).

### Python Requirements

To run the Amundsen ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[amundsen]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/amundsenConnection.json)
you can find the structure to create a connection to Amundsen.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=12 %}

**hostPort**: Host and port of the Amundsen Neo4j Connection. This expect a URI format like: bolt://localhost:7687.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

**username**: Username to connect to the Amundsen. This user should have privileges to read all the metadata in Amundsen.

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**password**: Password to connect to the Amundsen.

{% /codeInfo %}

{% codeInfo srNumber=15 %}

**maxConnectionLifeTime**: Maximum connection lifetime for the Amundsen Neo4j Connection.

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**validateSSL**: Enable SSL validation for the Amundsen Neo4j Connection.

{% /codeInfo %}

{% codeInfo srNumber=17 %}

**encrypted**: Enable encryption for the Amundsen Neo4j Connection.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=18 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}
{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: Amundsen
  serviceName: local_amundsen
  serviceConnection:
    config:
      type: Amundsen
```
```yaml {% srNumber=12 %}
      hostPort: http://localhost:10000
```
```yaml {% srNumber=13 %}
      username: username
```
```yaml {% srNumber=14 %}
      password: password
```
```yaml {% srNumber=15 %}
      maxConnectionLifeTime: 50
```
```yaml {% srNumber=16 %}
      validateSSL: false
```
```yaml {% srNumber=17 %}
      encrypted: false
```
```yaml
  sourceConfig:
    config:
      type: DatabaseMetadata
```
```yaml {% srNumber=18 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
