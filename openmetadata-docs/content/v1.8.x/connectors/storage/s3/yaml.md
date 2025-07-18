---
title: Run the S3 Storage Connector Externally
description: Use YAML to extract metadata from S3 including files, partitions, and access control details.
slug: /connectors/storage/s3/yaml
---

{% connectorDetailsHeader
name="S3 Storage"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=[]
/ %}

This page contains the setup guide and reference information for the S3 connector.

Configure and schedule S3 metadata workflows from the CLI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.0 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the metadata ingestion, we need the following permissions in AWS:

### S3 Permissions

For all the buckets that we want to ingest, we need to provide the following:
- `s3:ListBucket`
- `s3:GetObject`
- `s3:GetBucketLocation`
- `s3:ListAllMyBuckets`

Note that the `Resources` should be all the buckets that you'd like to scan. A possible policy could be:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket",
                "s3:GetBucketLocation",
                "s3:ListAllMyBuckets"
            ],
            "Resource": [
                "arn:aws:s3:::*"
            ]
        }
    ]
}
```

### CloudWatch Permissions

Which is used to fetch the total size in bytes for a bucket and the total number of files. It requires:
- `cloudwatch:GetMetricData`
- `cloudwatch:ListMetrics`

The policy would look like:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "cloudwatch:GetMetricData",
                "cloudwatch:ListMetrics"
            ],
            "Resource": "*"
        }
    ]
}
```

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the Athena ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[athena]"
```

### OpenMetadata Manifest

In any other connector, extracting metadata happens automatically. In this case, we will be able to extract high-level
metadata from buckets, but in order to understand their internal structure we need users to provide an `openmetadata.json`
file at the bucket root.

`Supported File Formats: [ "csv",  "tsv", "avro", "parquet", "json", "json.gz", "json.zip" ]`

You can learn more about this [here](/connectors/storage). Keep reading for an example on the shape of the manifest file.

{% partial file="/v1.8/connectors/storage/manifest.md" /%}

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/storage/s3Connection.json)
you can find the structure to create a connection to Athena.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Athena:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% partial file="/v1.8/connectors/yaml/common/aws-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/storage/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=11 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to storage service during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to storage service during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

- **Bucket Names (Optional)**: Provide the names of buckets that you would want to ingest, if you want to ingest metadata from all buckets or apply a filter to ingest buckets then leave this field empty.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: s3
  serviceName: local_s3
  serviceConnection:
    config:
      type: S3
      awsConfig:
```

{% partial file="/v1.8/connectors/yaml/common/aws-config.md" /%}

```yaml {% srNumber=13 %}
      bucketNames: 
      - s3-testing-1
      - s3-testing-2
```
```yaml {% srNumber=11 %}
      # connectionOptions:
        # key: value
```
```yaml {% srNumber=12 %}
      # connectionArguments:
        # key: value
```

{% partial file="/v1.8/connectors/yaml/storage/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}



{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}

## Related

{% tilesContainer %}

{% tile
   icon="mediation"
   title="Configure Ingestion Externally"
   description="Deploy, configure, and manage the ingestion workflows externally."
   link="/deployment/ingestion"
 / %}

{% /tilesContainer %}
