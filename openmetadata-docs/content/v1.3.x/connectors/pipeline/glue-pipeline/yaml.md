---
title: Run the Glue Pipeline Connector Externally
slug: /connectors/pipeline/glue-pipeline/yaml
---

{% connectorDetailsHeader
name="Glue"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status"]
unavailableFeatures=["Owners", "Tags", "Lineage"]
/ %}

In this section, we provide guides and references to use the Glue connector.

Configure and schedule Glue metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

The Glue connector ingests metadata through AWS [Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/glue.html) Client.
We will ingest Workflows, its jobs and their run status.

The user must have the following permissions for the ingestion to run successfully:

- `glue:ListWorkflows`
- `glue:GetWorkflow`
- `glue:GetJobRuns`

### Python Requirements

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

{% codeInfo srNumber=1 %}


**awsAccessKeyId**: Enter your secure access key ID for your Glue connection. The specified key ID should be
  authorized to read all databases you want to include in the metadata ingestion workflow.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).


{% /codeInfo %}

{% codeInfo srNumber=3 %}

**awsRegion**: Enter the location of the amazon cluster that your data and account are associated with.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**awsSessionToken**: The AWS session token is an optional parameter. If you want, enter the details of your temporary
  session token.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**endPointURL**: Your Glue connector will automatically determine the AWS Glue endpoint URL based on the region. You
  may override this behavior by entering a value to the endpoint URL.


{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: glue
  serviceName: local_glue
  serviceConnection:
    config:
      type: Glue
      awsConfig:
```
```yaml {% srNumber=1 %}
        awsAccessKeyId: KEY
```
```yaml {% srNumber=2 %}
        awsSecretAccessKey: SECRET
```
```yaml {% srNumber=3 %}
        awsRegion: us-east-2
```
```yaml {% srNumber=4 %}
        # awsSessionToken: TOKEN
```
```yaml {% srNumber=5 %}
        # endPointURL: https://glue.us-east-2.amazonaws.com/
```

{% partial file="/v1.3/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
