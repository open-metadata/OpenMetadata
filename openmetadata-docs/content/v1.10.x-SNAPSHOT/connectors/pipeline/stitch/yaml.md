---
title: Run the Stitch Connector Externally
description: Set up Stitch ingestion using YAML to automate metadata syncing from ELT sources to your central catalog.
slug: /connectors/pipeline/stitch/yaml
collate: true
---

{% connectorDetailsHeader
name="Stitch"
stage="PROD"
platform="Collate"
availableFeatures=["Pipelines", "Lineage"]
unavailableFeatures=["Owners", "Tags", "Pipeline Status"]
/ %}



In this section, we provide guides and references to use the Stitch connector.

Configure and schedule Stitch metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.10/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/stitch/yaml"} /%}

## Requirements

To extract metadata from Stitch, User first need to crate API crednetials:
- `Token`: Token to access Stitch metadata.


### Python Requirements

{% partial file="/v1.10/connectors/python-requirements.md" /%}

To run the Stitch ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[stitch]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/stitchConnection.json)
you can find the structure to create a connection to Stitch.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Stitch:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: The hostname or IP address with the REST API enabled eg.`https://api.stitchdata.com`

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**token**: Token to get access to Stitch metadata.

{% /codeInfo %}


{% partial file="/v1.10/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.10/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.10/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: stitch
  serviceName: stitch_data
  serviceConnection:
    config:
      type: Stitch
```
```yaml {% srNumber=1 %}
        hostPort: "https://api.stitchdata.com"
```
```yaml {% srNumber=2 %}
        token: "token"
```

{% partial file="/v1.10/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.10/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.10/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.10/connectors/yaml/ingestion-cli.md" /%}
