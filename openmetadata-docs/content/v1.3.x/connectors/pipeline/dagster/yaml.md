---
title: Run the Dagster Connector Externally
slug: /connectors/pipeline/dagster/yaml
---

{% connectorDetailsHeader
name="Dagster"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Tags"]
unavailableFeatures=["Owners", "Lineage"]
/ %}


In this section, we provide guides and references to use the Dagster connector.

Configure and schedule Dagster metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

To run the Dagster ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[dagster]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/dagsterConnection.json)
you can find the structure to create a connection to Dagster.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Dagster:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

- **host**: host and port for dagster pipeline

**Note**: If dagster is deployed on `localhost` and entering `https://localhost:3000` into hostPort gives a connection refused error, please enter `https://127.0.0.1:3000` into the hostPort and try again.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**Token** : Need pass token if connecting to `dagster cloud` instance

{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: dagster
  serviceName: dagster_source
  serviceConnection:
    config:
      type: Dagster
```
```yaml {% srNumber=1 %}
        host: "https://<yourorghere>.dagster.cloud/prod" # or http://127.0.0.1:3000
```
```yaml {% srNumber=2 %}
        token: token
```

{% partial file="/v1.3/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
