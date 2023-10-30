---
title: Run the Domo Pipeline Connector Externally
slug: /connectors/pipeline/domo-pipeline/yaml
---

# Run the Domo Pipeline Connector Externally

In this section, we provide guides and references to use the Domo Pipeline connector.

Configure and schedule Domo Pipeline metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{% /inlineCallout %}



**Note:** For metadata ingestion, kindly make sure add alteast `data` scopes to the clientId provided.
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


#### Source Configuration - Source Config

{% codeInfo srNumber=6 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/pipelineServiceMetadataPipeline.json):

**dbServiceNames**: Database Service Name for the creation of lineage, if the source supports it.

**includeTags**: Set the 'Include Tags' toggle to control whether to include tags as part of metadata ingestion.

**markDeletedPipelines**: Set the Mark Deleted Pipelines toggle to flag pipelines as soft-deleted if they are not present anymore in the source system.

**pipelineFilterPattern** and **chartFilterPattern**: Note that the `pipelineFilterPattern` and `chartFilterPattern` both support regex as include or exclude.

{% /codeInfo %}


#### Sink Configuration

{% codeInfo srNumber=7 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.2/connectors/yaml/workflow-config-def.md" /%}

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
```yaml {% srNumber=6 %}
  sourceConfig:
    config:
      type: PipelineMetadata
      # markDeletedPipelines: True
      # includeTags: True
      # includeLineage: true
      # pipelineFilterPattern:
      #   includes:
      #     - pipeline1
      #     - pipeline2
      #   excludes:
      #     - pipeline3
      #     - pipeline4
```
```yaml {% srNumber=7 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.2/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.2/connectors/yaml/ingestion-cli.md" /%}
