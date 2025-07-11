---
title: Run the S3 Datalake Connector Externally
slug: /connectors/database/s3-datalake/yaml
---

{% connectorDetailsHeader
name="S3 Datalake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "Sample Data", "Auto-Classification"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Owners", "dbt", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the S3 Datalake connector.

Configure and schedule S3 Datalake metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

**Note:** S3 Datalake connector supports extracting metadata from file types `JSON`, `CSV`, `TSV` & `Parquet`.


### S3 Permissions

To execute metadata extraction AWS account should have enough access to fetch required data. The <strong>Bucket Policy</strong> in AWS requires at least these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::<my bucket>",
                "arn:aws:s3:::<my bucket>/*"
            ]
        }
    ]
}
```

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

If running OpenMetadata version greater than 0.13, you will need to install the Datalake ingestion for S3:

#### S3 installation

```bash
pip3 install "openmetadata-ingestion[datalake-s3]"
```


#### If version <0.13

You will be installing the requirements for S3

```bash
pip3 install "openmetadata-ingestion[datalake]"
```

## Metadata Ingestion
All connectors are defined as JSON Schemas. Here you can find the structure to create a connection to Datalake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following JSON Schema.

## 1. Define the YAML Config

#### Source Configuration - Source Config using AWS S3

### This is a sample config for Datalake using AWS S3:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

* **schemaFilterPattern** and **tableFilterPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/common/aws-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: datalake
  serviceName: local_datalake
  serviceConnection:
    config:
      type: Datalake
```

```yaml {% srNumber=1 %}
      configSource:      
        securityConfig: 
```

{% partial file="/v1.8/connectors/yaml/common/aws-config.md" /%}

```yaml {% srNumber=1 %}
      bucketName: bucket name
      prefix: prefix
```

{% partial file="/v1.8/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}


{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
