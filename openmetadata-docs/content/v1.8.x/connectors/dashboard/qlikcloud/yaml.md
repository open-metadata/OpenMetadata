---
title: Run the Qlik Cloud Connector Externally
slug: /connectors/dashboard/qlikcloud/yaml
---

{% connectorDetailsHeader
  name="Qlik Cloud"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=[ "Projects", "Dashboards", "Charts", "Datamodels", "Lineage"]
  unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the PowerBI connector.

Configure and schedule PowerBI metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.8/connectors/python-requirements.md" /%}

To run the QlikCloud ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[qlikcloud]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/qlikCloudConnection.json)
you can find the structure to create a connection to QlikCloud.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Qlik Cloud:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**token**: Qlik Cloud API Access Token

Enter the JWT Bearer token generated from Qlik Management Console->API-Keys . Refer to [this](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-generate-api-keys.htm) document for more details.

Example: `eyJhbGciOiJFU***`

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**hostPort**: Qlik Cloud Tenant URL

This field refers to the base url of your Qlik Cloud Portal, will be used for generating the redirect links for dashboards and charts.

Example: `https://<TenantURL>.qlikcloud.com`

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**spaceTypes**: Qlik Cloud Space Types

Select relevant space types of Qlik Cloud to filter the dashboards ingested into the platform.

Example: `Personal`, `Shared`, `Managed`, `Data`

{% /codeInfo %}


{% partial file="/v1.8/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: qlikcloud
  serviceName: local_qlikcloud
  serviceConnection:
    config:
      type: QlikCloud
```
```yaml {% srNumber=1 %}
      token: eyJhbGciOiJFU***
```
```yaml {% srNumber=2 %}
      hostPort: https://<TenantURL>.qlikcloud.com
```
```yaml {% srNumber=3 %}
      spaceTypes: ["Personal", "Shared", "Managed", "Data"]
```

{% partial file="/v1.8/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.8/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.8/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.8/connectors/yaml/ingestion-cli.md" /%}
