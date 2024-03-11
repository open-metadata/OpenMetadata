---
title: Run the Fivetran Connector Externally
slug: /connectors/pipeline/fivetran/yaml
---

{% connectorDetailsHeader
name="Fivetran"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Fivetran connector.

Configure and schedule Fivetran metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

To access Fivetran APIs, a Fivetran account on a Standard, Enterprise, or Business Critical plan is required.

### Python Requirements

To run the Fivetran ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[fivetran]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/fivetranConnection.json)
you can find the structure to create a connection to Fivetran.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Fivetran:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**apiKey**: Fivetran API Key.

Follow the steps mentioned below to generate the Fivetran API key and API secret:
- Click your user name in your Fivetran dashboard.
- Click API Key.
- Click Generate API key. (If you already have an API key, then the button text is Generate new API key.)
- Make a note of the key and secret as they won't be displayed once you close the page or navigate away.

For more detailed documentation visit [here](https://fivetran.com/docs/rest-api/getting-started).

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**apiSecret**: Fivetran API Secret.

From the above step where the API key is generated copy the the API secret

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: HostPort of the Fivetran instance.

Hostport of the Fivetran instance that the connection will be made to
By default OpenMetadata will use `https://api.fivetran.com` to connect to the Fivetran APIs.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**limit**: Fivetran API Limit For Pagination.

This refers to the maximum number of records that can be returned in a single page of results when using Fivetran's API for pagination.

{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: fivetran
  serviceName: local_fivetran
  serviceConnection:
    config:
      type: Fivetran
```
```yaml {% srNumber=1 %}
      apiKey: <fivetran api key>
```
```yaml {% srNumber=2 %}
      apiSecret: <fivetran api secret>
```
```yaml {% srNumber=3 %}
      # hostPort: https://api.fivetran.com (default)
```
```yaml {% srNumber=4 %}
      # limit: 1000 (default)
```

{% partial file="/v1.3/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
