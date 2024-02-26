---
title: Run the Domo Pipeline Connector Externally
slug: /connectors/pipeline/domo-pipeline/yaml
---

{% connectorDetailsHeader
name="Domo"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}


In this section, we provide guides and references to use the Domo Pipeline connector.

Configure and schedule Domo Pipeline metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

**Note:** For metadata ingestion, kindly make sure add atleast `data` scopes to the clientId provided.
Question related to scopes, click [here](https://developer.domo.com/portal/1845fc11bbe5d-api-authentication).

### Python Requirements

To run the Domo Pipeline ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[domo]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/airbyteConnection.json)
you can find the structure to create a connection to Airbyte.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Domo-Pipeline:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**Client ID**: Client ID to Connect to DOMO Pipeline.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**Secret Token**: Secret Token to Connect DOMO Pipeline.


{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Access Token**: Access to Connect to DOMO Pipeline.


{% /codeInfo %}

{% codeInfo srNumber=4 %}

**API Host**:  API Host to Connect to DOMO Pipeline instance.


{% /codeInfo %}

{% codeInfo srNumber=5 %}

**Instance Domain**: URL to connect to your Domo instance UI. For example `https://<your>.domo.com`.


{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: domopipeline
  serviceName: domo-pipeline_source
  serviceConnection:
    config:
      type: DomoPipeline
```
```yaml {% srNumber=1 %}
      clientID: clientid
```
```yaml {% srNumber=2 %}
      secretToken: secret-token
```
```yaml {% srNumber=3 %}
      accessToken: access-token
```
```yaml {% srNumber=4 %}
      apiHost: api.domo.com
```
```yaml {% srNumber=5 %}
      instanceDomain: https://<your>.domo.com
```

{% partial file="/v1.3/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
