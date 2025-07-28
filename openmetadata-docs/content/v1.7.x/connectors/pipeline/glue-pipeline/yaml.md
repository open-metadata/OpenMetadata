---
title: Run the Glue Pipeline Connector Externally
description: Use the YAML config for Glue pipeline ingestion to define metadata patterns, connection parameters, and lineage capture logic.
slug: /connectors/pipeline/glue-pipeline/yaml
---

{% connectorDetailsHeader
name="Glue"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status", "Usage", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Glue connector.

Configure and schedule Glue metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

The Glue connector ingests metadata through AWS [Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/glue.html) Client.
We will ingest Workflows, its jobs and their run status.

The user must have the following permissions for the ingestion to run successfully:

- `glue:ListWorkflows`
- `glue:GetWorkflow`
- `glue:GetJobRuns`

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Glue ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[glue]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/glueConnection.json)
you can find the structure to create a connection to Glue.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Glue:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% partial file="/v1.7/connectors/yaml/common/aws-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: gluepipeline 
  serviceName: local_glue
  serviceConnection:
    config:
      type: GluePipeline
      awsConfig:
```
{% partial file="/v1.7/connectors/yaml/common/aws-config.md" /%}

{% partial file="/v1.7/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}
