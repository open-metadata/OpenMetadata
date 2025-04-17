---
title: Run the PowerBI Report Server Connector Externally
slug: /connectors/dashboard/powerbireportserver/yaml
---

{% connectorDetailsHeader
  name="PowerBI Report Server"
  stage="BETA"
  platform="Collate"
  availableFeatures=["Dashboards"]
  unavailableFeatures=["Owners", "Tags", "Datamodels", "Charts", "Lineage", "Projects"]
/ %}

In this section, we provide guides and references to use the PowerBI Report Server connector.

Configure and schedule PowerBI Report Server metadata for external ingestion:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

The PowerBI Report Server should be accessible from the ingestion environment.

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Metabase ingestion, you will need to install:

```bash
pip3 install "collate-ingestion[powerbi-report-server]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/powerBIReportServerConnection.json)
you can find the structure to create a connection to Metabase.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Metabase:

### 1. Define the YAML Config

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**:
This parameter specifies the host and port of the Metabase instance. This should be specified as a URI string in the format `http://hostname:port` or `https://hostname:port`. 
For example, you might set it to `http://192.168.1.1:80`.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**username**:
Username to connect to PowerBI Report Server.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**password**:
Password to connect to PowerBI Report Server.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**webPortalVirtualDirectory**
Web Portal Virtual Directory name which you have configured in your PowerBI Report Server configuration manager.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}


{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: powerbireportserver
  serviceName: <service name>
  serviceConnection:
    config:
      type: PowerBIReportServer
```
```yaml {% srNumber=1 %}
      hostPort: http://<your-host>
```
```yaml {% srNumber=2 %}
      username: username
```
```yaml {% srNumber=3 %}
      password: password
```
```yaml {% srNumber=3 %}
      webPortalVirtualDirectory: Reports
```

{% partial file="/v1.7/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}
