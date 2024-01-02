---
title: Run Domo Pipeline Connector using the CLI
slug: /connectors/pipeline/domo-pipeline/cli
---

# Run Domo Pipeline using the Metadata CLI

In this section, we provide guides and references to use the Domo Pipeline connector.

Configure and schedule Domo Pipeline metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{% /inlineCallout %}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

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

**SandBox Domain**: Connect to SandBox Domain.


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

#### Workflow Configuration

{% codeInfo srNumber=8 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

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
      sandboxDomain: https://<api_domo>.domo.com
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

```yaml {% srNumber=8 %}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

{% /codeBlock %}

{% /codePreview %}

### Workflow Configs for Security Provider

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).

## Openmetadata JWT Auth

- JWT tokens will allow your clients to authenticate against the OpenMetadata server. To enable JWT Tokens, you will get more details [here](/deployment/security/enable-jwt-tokens).

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

- You can refer to the JWT Troubleshooting section [link](/deployment/security/jwt-troubleshooting) for any issues in your JWT configuration. If you need information on configuring the ingestion with other security providers in your bots, you can follow this doc [link](/deployment/security/workflow-config-auth).

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.
