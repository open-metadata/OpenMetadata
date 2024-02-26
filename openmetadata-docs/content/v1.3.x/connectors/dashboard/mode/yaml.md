---
title: Run the Mode Connector Externally
slug: /connectors/dashboard/mode/yaml
---

{% connectorDetailsHeader
name="Mode"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Dashboards", "Charts", "Lineage"]
unavailableFeatures=["Owners", "Tags", "Datamodels", "Projects"]
/ %}

In this section, we provide guides and references to use the Mode connector.

Configure and schedule Mode metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

OpenMetadata relies on Mode's API, which is exclusive to members of the Mode Business Workspace. This means that only resources that belong to a Mode Business Workspace can be accessed via the API.

### Python Requirements

To run the Mode ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[mode]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/modeConnection.json)
you can find the structure to create a connection to Mode.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Mode:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: Host and Port Mode Dashboard.

The hostPort parameter specifies the host and port of the Mode server. This should be specified as a string in the format `https://app.mode.com`.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**accessToken**: Access Token for Mode Dashboard.

Get the Access Token by following below mentioned steps:
- Navigate to your Mode homepage.
- Click on your name in the upper left corner and click My Account.
- Click on API Tokens on the left side.
- To generate a new API token and password, enter a token name and click `Create token`.
- Copy the generated access token and password.

For detailed information visit [here](https://mode.com/developer/api-reference/introduction/).

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**accessTokenPassword**: Access Token Password for Mode Dashboard.

Copy the access token password from the step above where a new token is generated.

For detailed information visit [here](https://mode.com/developer/api-reference/introduction/).

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**workspaceName**: Mode Workspace Name.

Name of the mode workspace from where the metadata is to be fetched.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: mode
  serviceName: local_mode
  serviceConnection:
    config:
      type: Mode
```
```yaml {% srNumber=1 %}
      hostPort: https://app.mode.com
```
```yaml {% srNumber=2 %}
      access_token: access_token
```
```yaml {% srNumber=3 %}
      access_token_password: access_token_password
```
```yaml {% srNumber=4 %}
      workspace_name: workspace_name
```

{% partial file="/v1.3/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

