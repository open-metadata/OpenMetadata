---
title: Run the SSIS Connector Externally
slug: /connectors/pipeline/ssis/yaml
---

{% connectorDetailsHeader
name="SSIS"
stage="BETA"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage"]
unavailableFeatures=["Tags", "Owners"]
/ %}

In this section, we provide guides and references to use the SSIS connector.

Configure and schedule SSIS metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the SSIS ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[ssis]"
```


{% /note %}


## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/ssisConnection.json)
you can find the structure to create a connection to SSIS.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for SSIS:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

{% /codeInfo %}

{% codeInfo srNumber=1 %}

**connection**: 

In terms of `connection` we support the following selections:

- `Mssql`: Pass the required credentials to reach out this service. We will
  create a connection to the pointed database and read SSIS data from there.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: SSIS
  serviceName: ssis_source
  serviceConnection:
    config:
      type: SSIS
```
```yaml {% srNumber=6 %}
      # Connection needs to be Mssql
      databaseConnection:
        type: Mssql
        username: user
        password: pass
        database: db
        hostPort: localhost:1433
```

**storage**
Pass the `S3` credentials where your package folders are uploaded and specify the bucket name inside the `bucketNames` field.


```yaml {% srNumber=7 %}
      # Connection needs to be Mssql
      storageConnection:
        type: S3
        awsConfig:
          awsAccessKeyId: minio_user
          awsSecretAccessKey: minio_password
          awsRegion: us-east-2
          endPointURL: http://localhost:9000
        bucketNames: 
          - bucket_name
```


{% partial file="/v1.7/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}

