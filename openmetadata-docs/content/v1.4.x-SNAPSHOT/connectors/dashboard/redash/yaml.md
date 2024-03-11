---
title: Run the Redash Connector Externally
slug: /connectors/dashboard/redash/yaml
---

{% connectorDetailsHeader
  name="Redash"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Lineage", "Owners", "Tags"]
  unavailableFeatures=["Datamodels", "Projects"]
/ %}

In this section, we provide guides and references to use the Redash connector.

Configure and schedule Redash metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

To run the Redash ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[redash]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/redashConnection.json)
you can find the structure to create a connection to Redash.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: URL to the Redash instance.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**username**: Specify the User to connect to Redash. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**apiKey**: API key of the redash instance to access. It has the same permissions as the user who owns it.
Can be found on a user profile page.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**Redash Version**: Redash version of your redash instance. Enter the numerical value from the [Redash Releases](https://github.com/getredash/redash/releases) page. Default: `10.0.0`.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: redash
  serviceName: local_redash
  serviceConnection:
    config:
      type: Redash
```
```yaml {% srNumber=1 %}
      hostPort: http://localhost:5000
```
```yaml {% srNumber=2 %}
      username: random
```
```yaml {% srNumber=3 %}
      apiKey: api_key
```
```yaml {% srNumber=4 %}
      redashVersion: 10.0.0
```

{% partial file="/v1.3/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
