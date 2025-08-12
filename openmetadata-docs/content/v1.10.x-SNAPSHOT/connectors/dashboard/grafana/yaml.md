---
title: Run the Grafana Connector Externally
description: Learn to run the Grafana connector externally in OpenMetadata. Configure metadata ingestion via YAML, including Service Account Token auth, lineage, and SSL setup.
slug: /connectors/dashboard/grafana/yaml
---

{% connectorDetailsHeader
name="Grafana"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Dashboards", "Charts", "Owners", "Tags", "Lineage"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Grafana connector.

Configure and schedule Grafana metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.10/connectors/external-ingestion-deployment.md" /%}

## Requirements

You will need:

- Grafana 9.0+ (Service Account Tokens)
- Service Account Token with Admin role (for full metadata extraction)
- Network access to Grafana API endpoints

### Python Requirements

{% partial file="/v1.10/connectors/python-requirements.md" /%}

To run the Grafana ingestion, install:

```bash
pip3 install "openmetadata-ingestion[grafana]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/grafanaConnection.json)
you can find the structure to create a connection to Grafana.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

### 1. Define the YAML Config

This is a sample config for Grafana:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: URL or IP address of your Grafana instance.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**apiKey**: Service Account Token for authentication (format: `glsa_xxxxx`). Admin role recommended.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**verifySSL**: (Optional) Whether to verify SSL certificates. Default: true

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**pageSize**: (Optional) Page size for Grafana API pagination. Default: 100

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**includeTags**: When set to true, imports Grafana tags as OpenMetadata tags.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=6 %}

To send the metadata to OpenMetadata, specify `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.10/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="grafana-workflow.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: grafana
  serviceName: local_grafana
  serviceConnection:
    config:
      type: Grafana
      hostPort: https://grafana.example.com
      apiKey: glsa_xxxxxxxxxxxxxxxxxxxx
      verifySSL: true

sourceConfig:
  config:
    type: DashboardMetadata
    includeTags: true
    lineageInformation:
      dbServicePrefixes: ["mysql", "postgres"]

sink:
  type: metadata-rest
  config: {}

workflowConfig:
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

{% /codeBlock %}

{% /codePreview %}

## Securing Grafana Connection with SSL in OpenMetadata

{% partial file="/v1.10/connectors/yaml/ingestion-cli.md" /%}
