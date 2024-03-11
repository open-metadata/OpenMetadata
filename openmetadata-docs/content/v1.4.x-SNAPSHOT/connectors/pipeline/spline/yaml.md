---
title: Run the Spline Connector Externally
slug: /connectors/pipeline/spline/yaml
---

{% connectorDetailsHeader
name="Spline"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status"]
unavailableFeatures=["Owners", "Tags", "Lineage"]
/ %}

In this section, we provide guides and references to use the Spline connector.

Configure and schedule Spline metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

The Spline connector support lineage of data source of type `jdbc` or `dbfs` i.e. The spline connector would be able to extract lineage if the data source is either a jdbc connection or the data source is databricks instance.

{% note %}

Currently we do not support data source of type aws s3 or any other cloud storage, which also means that the lineage for external tables from databricks will not be extracted. 

{% /note %}

You can refer [this](https://github.com/AbsaOSS/spline-getting-started/tree/main/spline-on-databricks) documentation on how to configure databricks with spline.


### Python Requirements

To run the Spline ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/splineConnection.json)
you can find the structure to create a connection to Spline.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Spline:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: Spline REST Server API Host & Port, OpenMetadata uses Spline REST Server APIs to extract the execution details from spline to generate lineage. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8080`, `http://host.docker.internal:8080`.

**uiHostPort**: Spline UI Host & Port is an optional field which is used for generating redirection URL from OpenMetadata to Spline Portal. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:9090`, `http://host.docker.internal:9090`.


{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/pipeline/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: spline
  serviceName: spline_source
  serviceConnection:
    config:
      type: Spline
```
```yaml {% srNumber=1 %}
      hostPort: http://localhost:8080
      uiHostPort: http://localhost:9090
```

{% partial file="/v1.3/connectors/yaml/pipeline/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}


{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
