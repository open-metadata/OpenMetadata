---
title: Elasticsearch
slug: /connectors/search/elasticsearch
---

{% connectorDetailsHeader
name="Elasticsearch"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Search Indexes", "Sample Data"]
unavailableFeatures=[]
/ %}


In this section, we provide guides and references to use the Elasticsearch connector.

Configure and schedule Elasticsearch metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/search/elasticsearch/yaml"} /%}

## Requirements

We support Elasticsearch 7.0 and above.

We extract Elasticsearch's metadata by using its [API](https://www.elastic.co/guide/en/elasticsearch/reference/current/rest-apis.html). To run this ingestion, you just need a user with permissions to the ElasticSearch instance.


## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "ElasticSearch", 
    selectServicePath: "/images/v1.3/connectors/elasticsearch/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/elasticsearch/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/elasticsearch/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: This parameter specifies the host and port of the Elasticsearch instance. This should be specified as a URI string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set it to `https://localhost:9200`.
- **Authentication Types**:
    1. Basic Authentication
    - Username: Username to connect to Elasticsearch required when Basic Authentication is enabled on Elasticsearch.
    - Password: Password of the user account to connect with Elasticsearch.
    2. API Key Authentication
    - API Key: API Key to connect to Elasticsearch required when API Key Authentication is enabled on Elasticsearch.
    - API Key Id: Enter API Key ID In case of API Key Authentication if there is any API Key ID associated with the API Key, otherwise this field can be left blank.
- **SSL Certificates**:
    1. SSL Certificates By Path
    - CA Certificate Path: This field specifies the path of CA certificate required for authentication.
    - Client Certificate Path: This field specifies the path of Clint certificate required for authentication.
    - Private Key Path: This field specifies the path of Clint Key/Private Key required for authentication.
    
    2. SSL Certificates By Value
    - CA Certificate Value: This field specifies the value of CA certificate required for authentication.
    - Client Certificate Value: This field specifies the value of Clint certificate required for authentication.
    - Private Key Value: This field specifies the value of Clint Key/Private Key required for authentication.
    - Staging Directory Path: This field specifies the path to temporary staging directory, where the certificates will be stored temporarily during the ingestion process, which will de deleted once the ingestion job is over.
    - when you are using this approach make sure you are passing the key in a correct format. If your certificate looks like this:
    ```
    -----BEGIN CERTIFICATE-----
    MII..
    MBQ...
    CgU..
    8Lt..
    ...
    h+4=
    -----END CERTIFICATE-----
    ```

    You will have to replace new lines with `\n` and the final value that you need to pass should look like this:

    ```
    -----BEGIN CERTIFICATE-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END CERTIFICATE-----\n

- **Connection Timeout in Seconds**: Connection timeout configuration for communicating with Elasticsearch APIs.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/search/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
