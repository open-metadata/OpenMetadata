---
title: Run the Sagemaker Connector Externally
description: Configure SageMaker ingestion with YAML to extract model metadata, metrics, and lineage from ML pipelines.
slug: /connectors/ml-model/sagemaker/yaml
---

{% connectorDetailsHeader
name="Sagemaker"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["ML Store"]
unavailableFeatures=["ML Features", "Hyperparameters"]
/ %}

In this section, we provide guides and references to use the Sagemaker connector.

Configure and schedule Sagemaker metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

OpenMetadata retrieves information about models and tags associated with the models in the AWS account.
The user must have the following policy set to ingest the metadata from Sagemaker.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "SageMakerPolicy",
            "Effect": "Allow",
            "Action": [
                "sagemaker:ListModels",
                "sagemaker:DescribeModel",
                "sagemaker:ListTags"
            ],
            "Resource": "*"
        }
    ]
}
```

For more information on Sagemaker permissions visit the [AWS Sagemaker official documentation](https://docs.aws.amazon.com/sagemaker/latest/dg/api-permissions-reference.html).

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Sagemaker ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[sagemaker]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/mlmodel/sageMakerConnection.json )
you can find the structure to create a connection to Sagemaker.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/mlmodelServiceMetadataPipeline.json)

### 1. Define the YAML Config

This is a sample config for Sagemaker:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% partial file="/v1.7/connectors/yaml/common/aws-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ml-model/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: sagemaker
  serviceName: local_sagemaker
  serviceConnection:
    config:
      type: SageMaker
      awsConfig:
```

{% partial file="/v1.7/connectors/yaml/common/aws-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ml-model/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}
