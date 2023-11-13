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
- **sslConfig**:
    1. SSL Certificates By Path
    - caCertPath: This field specifies the path of CA certificate required for authentication.
    - clientCertPath: This field specifies the path of Clint certificate required for authentication.
    - privateKeyPath: This field specifies the path of Clint Key/Private Key required for authentication.
    
    2. SSL Certificates By Value
    - caCertValue: This field specifies the value of CA certificate required for authentication.
    - clientCertValue: This field specifies the value of Clint certificate required for authentication.
    - privateKeyValue: This field specifies the value of Clint Key/Private Key required for authentication.
    - stagingDir: This field specifies the path to temporary staging directory, where the certificates will be stored temporarily during the ingestion process, which will de deleted once the ingestion job is over.
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

{% /codeInfo %}


{% codeInfo srNumber=5 %}
**connectionTimeoutSecs**: Connection timeout configuration for communicating with ElasticSearch APIs.
{% /codeInfo %}



#### Source Configuration - Source Config

{% codeInfo srNumber=6 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/searchServiceMetadataPipeline.json):

**includeSampleData**: Set the Ingest Sample Data toggle to control whether to ingest sample data as part of metadata ingestion.

**sampleSize**: If include sample data is enabled, 10 records will be ingested by default. Using this field you can customize the size of sample data.

**markDeletedSearchIndexes**: Optional configuration to soft delete `search indexes` in OpenMetadata if the source `search indexes` are deleted. After deleting, all the associated entities like lineage, etc., with that `search index` will be deleted.

**searchIndexFilterPattern**: Note that the `searchIndexFilterPattern` support regex to include or exclude search indexes during metadata ingestion process.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=7%}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.2/connectors/workflow-config.md" /%}

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
      sslConfig:
        certificates:
          caCertPath: /path/to/http_ca.crt
          clientCertPath: /path/to/http_ca.crt
          privateKeyPath: /path/to/http_ca.crt

          # pass certificate values
          # caCertValue: -----BEGIN CERTIFICATE-----\n....\n.....\n-----END CERTIFICATE-----\n
          # clientCertValue: -----BEGIN CERTIFICATE-----\n....\n...-----END CERTIFICATE-----\n
          # privateKeyValue: -----BEGIN RSA PRIVATE KEY-----\n....\n....\n-----END RSA PRIVATE KEY-----\n
          # stagingDir: /tmp/stage
```
```yaml {% srNumber=5 %}
      connectionTimeoutSecs: 30
```
```yaml {% srNumber=6 %}
  sourceConfig:
    config:
      type: SearchMetadata
      # markDeletedSearchIndexes: True
      # includeSampleData: True
      # sampleSize: 10
      # searchIndexFilterPattern:
      #   includes:
      #     - index1
      #     - index2
      #   excludes:
      #     - index4
      #     - index3
```
```yaml {% srNumber=7 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.2/connectors/workflow-config-yaml.md" /%}

{% /codeBlock %}

{% /codePreview %}

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.
