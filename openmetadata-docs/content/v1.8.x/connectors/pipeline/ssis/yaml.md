---
title: Run the SSIS Connector Externally
slug: /connectors/pipeline/ssis/yaml
collate: true
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

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

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

{% partial file="/v1.8/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

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
      databaseConnection:
        type: Mssql
        username: user
        password: pass
        database: db
        hostPort: localhost:1433
```

**storage**:  
To extract task dependencies and lineage, the connector needs access to your SSIS package XML files.  
You can either provide the local path to your project folders, or upload your projects to an S3 bucket and supply the bucket name along with S3 credentials.

- For s3

Pass the `S3` credentials where your package folders are uploaded and specify the bucket name inside the `bucketNames` field.


```yaml {% srNumber=7 %}
      storageConnection:
        type: S3
        awsConfig:
          awsAccessKeyId: test
          awsSecretAccessKey: test
          awsRegion: us-east-2
          endPointURL: https://packages.s3.us-east-2.amazonaws.com
        bucketNames: 
          - bucket_name
```
- For Local
```yaml {% srNumber=8 %}
  localProjectsPath: /home/user/repos/
```

{% partial file="/v1.8/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}

