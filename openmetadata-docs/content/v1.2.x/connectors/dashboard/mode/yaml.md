---
title: Run the Mode Connector Externally
slug: /connectors/dashboard/mode/yaml
---

# Run the Mode Connector Externally

| Stage      | PROD                         |
|------------|------------------------------|
| Dashboards | {% icon iconName="check" /%} |
| Charts     | {% icon iconName="check" /%} |
| Owners     | {% icon iconName="cross" /%} |
| Tags       | {% icon iconName="cross" /%} |
| Datamodels | {% icon iconName="cross" /%} |
| Projects   | {% icon iconName="cross" /%} |
| Lineage    | {% icon iconName="check" /%} |

In this section, we provide guides and references to use the Mode connector.

Configure and schedule Mode metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

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

#### Source Configuration - Source Config

{% codeInfo srNumber=5 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/dashboardServiceMetadataPipeline.json):

- **dbServiceNames**: Database Service Names for ingesting lineage if the source supports it.
- **dashboardFilterPattern**, **chartFilterPattern**, **dataModelFilterPattern**: Note that all of them support regex as include or exclude. E.g., "My dashboard, My dash.*, .*Dashboard".
- **projectFilterPattern**: Filter the dashboards, charts and data sources by projects. Note that all of them support regex as include or exclude. E.g., "My project, My proj.*, .*Project".
- **includeOwners**: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.
- **includeTags**: Set the 'Include Tags' toggle to control whether to include tags in metadata ingestion.
- **includeDataModels**: Set the 'Include Data Models' toggle to control whether to include tags as part of metadata ingestion.
- **markDeletedDashboards**: Set the 'Mark Deleted Dashboards' toggle to flag dashboards as soft-deleted if they are not present anymore in the source system.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=6 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.2/connectors/workflow-config.md" /%}

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
```yaml {% srNumber=5 %}
  sourceConfig:
    config:
      type: DashboardMetadata
      # dbServiceNames:
      #   - service1
      #   - service2
      # dashboardFilterPattern:
      #   includes:
      #     - dashboard1
      #     - dashboard2
      #   excludes:
      #     - dashboard3
      #     - dashboard4
      # chartFilterPattern:
      #   includes:
      #     - chart1
      #     - chart2
      #   excludes:
      #     - chart3
      #     - chart4
      # projectFilterPattern:
      #   includes:
      #     - project1
      #     - project2
      #   excludes:
      #     - project3
      #     - project4
```
```yaml {% srNumber=6 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.2/connectors/workflow-config-yaml.md" /%}

{% /codeBlock %}

{% /codePreview %}

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.

