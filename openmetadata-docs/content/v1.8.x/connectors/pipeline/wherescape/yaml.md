---
title: Run the Wherescape Connector Externally
slug: /connectors/pipeline/wherescape/yaml
---

{% connectorDetailsHeader
name="Wherescape"
stage="BETA"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage", "Owners"]
unavailableFeatures=["Tags"]
/ %}

In this section, we provide guides and references to use the Wherescape connector.

Configure and schedule Wherescape metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the Wherescape ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[wherescape]"
```


{% /note %}


## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/wherescapeConnection.json)
you can find the structure to create a connection to Wherescape.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Wherescape:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

{% /codeInfo %}

{% codeInfo srNumber=1 %}

**connection**: 

In terms of `connection` we support the following selections:

- `Mssql`: Pass the required credentials to reach out this service. We will
  create a connection to the pointed database and read Wherescape data from there.

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: wherescape
  serviceName: wherescape_source
  serviceConnection:
    config:
      type: Wherescape
```
```yaml {% srNumber=6 %}
      # Connection needs to be Mssql
      connection:
        type: Mssql
        username: user
        authType:
          password: pass
        databaseSchema: db
        hostPort: localhost:1433
```

{% partial file="/v1.8/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}

