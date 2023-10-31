---
title: Run the ElasticSearch Connector Externally
slug: /connectors/search/elasticsearch/yaml
---

# Run the ElasticSearch Connector Externally

In this section, we provide guides and references to use the ElasticSearch connector.

Configure and schedule ElasticSearch metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{% /inlineCallout %}



### Python Requirements

To run the ElasticSearch ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[elasticsearch]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/search/elasticSearchConnection.json)
you can find the structure to create a connection to ElasticSearch.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for ElasticSearch:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: This parameter specifies the host and port of the ElasticSearch instance. This should be specified as a URI string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set it to `https://localhost:9200`.

{% /codeInfo %}


{% codeInfo srNumber=2 %}
**Basic Authentication**

**username**: Username to connect to ElasticSearch required when Basic Authentication is enabled on ElasticSearch.
**password**: Password of the user account to connect with ElasticSearch.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**API Key Authentication**

**apiKey**:  API Key to connect to ElasticSearch required when API Key Authentication is enabled on ElasticSearch.
**apiKeyId**: Enter API Key ID In case of API Key Authentication if there is any API Key ID associated with the API Key, otherwise this field can be left blank or skipped.

{% /codeInfo %}

{% codeInfo srNumber=4 %}
**caCert**: In case the SSL is enabled on your ElasticSearch instance and CA certificate is required for authentication, then specify the path of certificate in this field. NOTE: In case of docker deployment you need to store this certificate accessible to OpenMetadata Ingestion docker container, you can do it via copying the certificate to the docker container or store it in the volume associate with the OpenMetadata Ingestion container.
{% /codeInfo %}


{% codeInfo srNumber=5 %}
**connectionTimeoutSecs**: Connection timeout configuration for communicating with ElasticSearch APIs.
{% /codeInfo %}

{% partial file="/v1.2/connectors/yaml/search/source-config-def.md" /%}

{% partial file="/v1.2/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.2/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: elasticsearch
  serviceName: elasticsearch_source
  serviceConnection:
    config:
      type: ElasticSearch
```
```yaml {% srNumber=1 %}
      hostPort: http://localhost:9200
```
```yaml {% srNumber=2 %}
      authType:
        username: elastic
        password: my_own_password
```
```yaml {% srNumber=3 %}
        # apiKeyId: <api key id>
        # apiKey: <api key>
```
```yaml {% srNumber=4 %}
      caCert: /path/to/http_ca.crt
```
```yaml {% srNumber=5 %}
      connectionTimeoutSecs: 30
```

{% partial file="/v1.2/connectors/yaml/search/source-config.md" /%}

{% partial file="/v1.2/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.2/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.2/connectors/yaml/ingestion-cli.md" /%}
