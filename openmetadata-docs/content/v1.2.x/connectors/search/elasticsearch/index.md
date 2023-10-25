---
title: ElasticSearch
slug: /connectors/search/elasticsearch
---

# ElasticSearch

| Feature            | Status               |
|------------|------------------------------|
| Search Indexes | {% icon iconName="check" /%} |
| Sample Data | {% icon iconName="check" /%} |
| Supported Versions | ElasticSearch 7.0 and above |
| Stage              | BETA                      |

In this section, we provide guides and references to use the ElasticSearch connector.

Configure and schedule ElasticSearch metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.2/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/search/elasticsearch/yaml"} /%}

## Requirements

We extract ElasticSearch's metadata by using its [API](https://www.elastic.co/guide/en/elasticsearch/reference/current/rest-apis.html). To run this ingestion, you just need a user with permissions to the ElasticSearch instance.


## Metadata Ingestion

{% partial 
  file="/v1.2/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "ElasticSearch", 
    selectServicePath: "/images/v1.2/connectors/elasticsearch/select-service.png",
    addNewServicePath: "/images/v1.2/connectors/elasticsearch/add-new-service.png",
    serviceConnectionPath: "/images/v1.2/connectors/elasticsearch/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: This parameter specifies the host and port of the ElasticSearch instance. This should be specified as a URI string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set it to `https://localhost:9200`.
- **Authentication Types**:
    1. Basic Authentication
    - Username: Username to connect to ElasticSearch required when Basic Authentication is enabled on ElasticSearch.
    - Password: Password of the user account to connect with ElasticSearch.
    2. API Key Authentication
    - API Key: API Key to connect to ElasticSearch required when API Key Authentication is enabled on ElasticSearch.
    - API Key Id: Enter API Key ID In case of API Key Authentication if there is any API Key ID associated with the API Key, otherwise this field can be left blank..
- **Client Certificate Path**: In case the SSL is enabled on your ElasticSearch instance and CA certificate is required for authentication, then specify the path of certificate in this field. NOTE: In case of docker deployment you need to store this certificate accessible to OpenMetadata Ingestion docker container, you can do it via copying the certificate to the docker container or store it in the volume associate with the OpenMetadata Ingestion container.
- **Connection Timeout in Seconds**: Connection timeout configuration for communicating with ElasticSearch APIs.

{% /extraContent %}

{% partial file="/v1.2/connectors/test-connection.md" /%}

{% partial file="/v1.2/connectors/search/configure-ingestion.md" /%}

{% partial file="/v1.2/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.2/connectors/troubleshooting.md" /%}
