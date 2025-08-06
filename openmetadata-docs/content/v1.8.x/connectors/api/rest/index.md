---
title: REST API Connector | `brandName` Integration Documentation
description: Learn how to integrate REST APIs with `brandName` connectors. Complete documentation, setup guides, and examples for seamless data source connections.
slug: /connectors/api/rest
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
- [Troubleshooting](/connectors/api/rest/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/api/rest/yaml"} /%}

## Requirements

### Generate OpenAPI Schema URL

- Generate OpenAPI schema url for your service[OpenAPI spec](https://swagger.io/specification/#openapi-document)


## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "VertexAI", 
    selectServicePath: "/images/v1.8/connectors/rest/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/rest/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/rest/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

**OpenAPI Schema URL**: 
An OpenAPI schema URL typically refers to the URL where the OpenAPI Specification (OAS) document of a web service is hosted. The document defines the service's API, including available endpoints, request/response formats, authentication methods, etc. It is usually in JSON format. for e.g. `https://petstore3.swagger.io/api/v3/openapi.json`

**Token**: An authentication token to connect to an OpenAPI schema URL. It is only required if the API schema is protected or secured.


{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}


{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
