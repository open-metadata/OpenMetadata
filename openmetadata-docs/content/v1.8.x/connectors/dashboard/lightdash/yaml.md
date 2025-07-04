---
title: Run the Lightdash Connector Externally
description: Configure Lightdash dashboard connector for OpenMetadata using YAML. Step-by-step setup guide with examples to integrate your BI dashboards seamlessly.
slug: /connectors/dashboard/lightdash/yaml
---

{% connectorDetailsHeader
  name="Lightdash"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Owners", "Datamodels", "Lineage"]
  unavailableFeatures=["Tags", "Projects"]
/ %}

In this section, we provide guides and references to use the Lightdash connector.

Configure and schedule Lightdash metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

To integrate Lightdash, ensure you are using OpenMetadata version 1.2.x or higher.

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the Lightdash ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas. 
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/lightdashConnection.json)
you can find the structure to create a connection to Lightdash.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Lightdash:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

- **Host and Port**: Specify the network location where your Lightdash instance is accessible, combining both hostname and port in a URI format: either `http://hostname:port` or `https://hostname:port`, based on your security needs.
**Example**: For a local setup, use `http://localhost:8080`; for a server deployment, it might be `https://lightdash.example.com:3000`.
Ensure the specified port is open and accessible through network firewall settings.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

- **API Key**: This key authenticates requests to your Lightdash instance. Keep the API Key secure, sharing it only with authorized applications or users.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

- **Project UUID**: This unique identifier links API requests or configurations to a specific project in Lightdash. 

{% /codeInfo %}

{% codeInfo srNumber=4 %}

- **Space UUID**: Identifies a specific "Space" in Lightdash, used to organize dashboards, charts, and assets.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

- **Proxy Authentication**: If your Lightdash instance requires authentication through a proxy server, provide proxy credentials. Proxy authentication controls access to external resources and Lightdash.

{% /codeInfo %}

{% partial file="/v1.8/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: lightdash
  serviceName: local_lightdash
  serviceConnection:
    config:
      type: Lightdash
```
```yaml {% srNumber=1 %}
      hostPort: https://app.lightdash.cloud
```
```yaml {% srNumber=2 %}
      apiKey: <apiKey>
```
```yaml {% srNumber=3 %}
      projectUUID: <projectUUID>
```
```yaml {% srNumber=4 %}
      spaceUUID: <spaceUUID>
```
```yaml {% srNumber=5 %}
      proxyAuthentication: <ProxyAuthentication>
```

{% partial file="/v1.8/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}
