---
title: Run the Teradata Connector Externally
slug: /connectors/database/teradata/yaml
---

{% connectorDetailsHeader
name="Teradata"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "Sample Data"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures", "dbt"]
/ %}

In this section, we provide guides and references to use the Teradata connector.

Configure and schedule Greenplum Teradata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Lineage](#lineage)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)


{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Teradata ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[teradata]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/teradataConnection.json)
you can find the structure to create a connection to Teradata.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Teradata:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Teradata.

{% /codeInfo %}
{% codeInfo srNumber=2 %}

**password**: User password to connect to Teradata

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: Enter the fully qualified hostname and port number for your Greenplum deployment in the Host and Port field.

{% /codeInfo %}




{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: teradata
  serviceName: example_teradata
  serviceConnection:
    config:
      type: Teradata
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      password: <password>
```
```yaml {% srNumber=3 %}
      hostPort: teradata:1025
```

{% partial file="/v1.7/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.7/connectors/yaml/lineage.md" variables={connector: "teradata"} /%}

{% partial file="/v1.7/connectors/yaml/data-profiler.md" variables={connector: "teradata"} /%}

{% partial file="/v1.7/connectors/yaml/auto-classification.md" variables={connector: "teradata"} /%}

{% partial file="/v1.7/connectors/yaml/data-quality.md" /%}
