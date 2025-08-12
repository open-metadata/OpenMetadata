---
title: Run the OpenAPI/REST Connector Externally
description: Learn how to configure OpenMetadata REST API connectors using YAML. Complete documentation with examples, parameters, and best practices for seamless integration.
slug: /connectors/api/rest/yaml
---

{% connectorDetailsHeader
name="REST"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["API Endpoint", "Request Schema", "Response Schema"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the OpenAPI/REST connector.

Configure and schedule REST metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.10/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.10/connectors/python-requirements.md" /%}


### Generate OpenAPI Schema URL

- Generate OpenAPI schema url for your service[OpenAPI spec](https://swagger.io/specification/#openapi-document)


## Metadata Ingestion

### 1. Define the YAML Config

This is a sample config for OpenAPI:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**OpenAPI Schema URL**:
An OpenAPI schema URL typically refers to the URL where the OpenAPI Specification (OAS) document of a web service is hosted. The document defines the service's API, including available endpoints, request/response formats, authentication methods, etc. It is usually in JSON format. for e.g. `https://petstore3.swagger.io/api/v3/openapi.json`

**Token**: An authentication token to connect to an OpenAPI schema URL. It is only required if the API schema is protected or secured.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: rest
  serviceName: openapi_rest
  serviceConnection:
    config:
      type: ApiMetadata
```
```yaml {% srNumber=1 %}
      openAPISchemaURL: https://docs.open-metadata.org/swagger.json

```


{% partial file="/v1.10/connectors/yaml/api/source-config.md" /%}

{% partial file="/v1.10/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.10/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.10/connectors/yaml/ingestion-cli.md" /%}
