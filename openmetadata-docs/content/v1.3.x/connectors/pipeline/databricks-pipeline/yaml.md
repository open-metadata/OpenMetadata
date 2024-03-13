---
title: Run the Databricks Pipeline Connector Externally
slug: /connectors/pipeline/databricks-pipeline/yaml
---

{% connectorDetailsHeader
name="Databricks"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status"]
unavailableFeatures=["Owners", "Tags", "Lineage"]
/ %}

In this section, we provide guides and references to use the Databricks Pipeline connector.

Configure and schedule Databricks Pipeline metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

To run the Databricks Pipeline ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[databricks]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/databricksPipelineConnection.json)
you can find the structure to create a connection to Databricks Pipeline.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Databricks Pipeline:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**Host and Port**: Enter the fully qualified hostname and port number for your Databricks Pipeline deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**Token**: Generated Token to connect to Databricks Pipeline.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Databricks during the connection. These details must be added as Key-Value pairs.
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`


**HTTP Path**: Databricks Pipeline compute resources URL.

{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: databrickspipeline
  serviceName: local_databricks_pipeline
  serviceConnection:
    config:
      type: DatabricksPipeline

```
```yaml {% srNumber=1 %}
      hostPort: localhost:443

```

```yaml {% srNumber=2 %}
      token: <databricks token>

```
```yaml {% srNumber=3 %}
      connectionArguments:
        http_path: <http path of databricks cluster>
```

{% partial file="/v1.3/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
