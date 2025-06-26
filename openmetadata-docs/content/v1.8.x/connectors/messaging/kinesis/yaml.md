---
title: Run the Kinesis Connector Externally
slug: /connectors/messaging/kinesis/yaml
---

{% connectorDetailsHeader
name="Kinesis"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Topics", "Sample Data"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Kinesis connector.

Configure and schedule Kinesis metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

OpenMetadata retrieves information about streams and sample data from the streams in the AWS account.
The user must have the following policy set to access the metadata from Kinesis.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "KinesisPolicy",
            "Effect": "Allow",
            "Action": [
                "kinesis:ListStreams",
                "kinesis:DescribeStreamSummary",
                "kinesis:ListShards",
                "kinesis:GetShardIterator",
                "kinesis:GetRecords"
            ],
            "Resource": "*"
        }
    ]
}
```

For more information on Kinesis permissions visit the [AWS Kinesis official documentation](https://docs.aws.amazon.com/streams/latest/dev/controlling-access.html).

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the Kinesis ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[kinesis]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/messaging/kinesisConnection.json)
you can find the structure to create a connection to Kinesis.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Kinesis:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% partial file="/v1.8/connectors/yaml/common/aws-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/messaging/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: kinesis
  serviceName: local_kinesis
  serviceConnection:
    config:
      type: Kinesis
      awsConfig:
```

{% partial file="/v1.8/connectors/yaml/common/aws-config.md" /%}

{% partial file="/v1.8/connectors/yaml/messaging/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}
