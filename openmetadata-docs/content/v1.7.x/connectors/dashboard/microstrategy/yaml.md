---
title: Run the MicroStrategy Connector Externally
slug: /connectors/dashboard/microstrategy/yaml
---

{% connectorDetailsHeader
  name="MicroStrategy"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Owners", "Datamodels", "Lineage"]
  unavailableFeatures=["Tags", "Projects"]
/ %}

In this section, we provide guides and references to use the MicroStrategy connector.

Configure and schedule MicroStrategy metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

To integrate MicroStrategy, ensure you are using OpenMetadata version 1.2.x or higher.

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the MicroStrategy ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[microstrategy]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas. 
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/mstrConnection.json)
you can find the structure to create a connection to MicroStrategy.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for MicroStrategy:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

- **Username**: Username to connect to MicroStrategy, e.g., user@organization.com. This user should have access to relevant dashboards and charts in MicroStrategy to fetch the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

- **Password**: Password of the user account to connect with MicroStrategy.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

- **Host Port**: This parameter specifies the host of the MicroStrategy instance. This should be specified as a URI string in the format http://hostname or https://hostname.

For example, you might set it to https://demo.microstrategy.com.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

- **Project Name**: The name of the project within MicroStrategy that OpenMetadata will connect to, linking to the relevant dashboards and reports for metadata retrieval.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

- **Login Mode**: Login Mode for Microstrategy's REST API connection. You can authenticate with one of the following authentication modes: `Standard (1)`, `Anonymous (8)`. Default will be `Standard (1)`.
If you're using demo account for Microstrategy, it will be needed to authenticate through loginMode `8`.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: microstrategy
  serviceName: local_Mstr
  serviceConnection:
    config:
      type: MicroStrategy
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      password: password
```
```yaml {% srNumber=3 %}
      hostPort: http://hostPort
```
```yaml {% srNumber=4 %}
      projectName: project
```
```yaml {% srNumber=5 %}
      loginMode: "1"
```

{% partial file="/v1.7/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}
