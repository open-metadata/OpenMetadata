---
title: Run the Mlflow Connector Externally
slug: /connectors/ml-model/mlflow/yaml
---

# Run the Mlflow Connector Externally

In this section, we provide guides and references to use the Mlflow connector.

Configure and schedule Mlflow metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}



### Python Requirements

To run the Mlflow ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[mlflow]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/mlmodel/mlflowConnection.json)
you can find the structure to create a connection to Mlflow.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadatablob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Mlflow:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**trackingUri**: Mlflow Experiment tracking URI. E.g., http://localhost:5000


{% /codeInfo %}

{% codeInfo srNumber=2 %}

**registryUri**: Mlflow Model registry backend. E.g., mysql+pymysql://mlflow:password@localhost:3307/experiments

{% /codeInfo %}

#### Source Configuration - Source Config

{% codeInfo srNumber=3 %}

The sourceConfig is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/messagingServiceMetadataPipeline.json):

**markDeletedMlModels**: Set the Mark Deleted Ml Models toggle to flag ml models as soft-deleted if they are not present anymore in the source system.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=4 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.2/connectors/workflow-config.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: mlflow
  serviceName: local_mlflow
  serviceConnection:
    config:
      type: Mlflow
```
```yaml {% srNumber=1 %}
      trackingUri: http://localhost:5000
```
```yaml {% srNumber=2 %}
      registryUri: mysql+pymysql://mlflow:password@localhost:3307/experiments
```
```yaml {% srNumber=3 %}
  sourceConfig:
    config:
      type: MlModelMetadata
      # markDeletedMlModels: true
```
```yaml {% srNumber=4 %}
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
