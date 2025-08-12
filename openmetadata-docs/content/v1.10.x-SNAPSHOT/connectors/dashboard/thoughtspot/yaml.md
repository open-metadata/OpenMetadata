---
title: Run the ThoughtSpot Connector Externally
description: Learn to run the ThoughtSpot connector externally in OpenMetadata. Configure metadata ingestion via YAML, including API auth, lineage, and SSL setup.
slug: /connectors/dashboard/thoughtspot/yaml
collate: true
---

{% connectorDetailsHeader
name="ThoughtSpot"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Dashboards", "Charts", "Owners", "Datamodels", "Lineage"]
unavailableFeatures=["Projects"]
/ %}

In this section, we provide guides and references to use the ThoughtSpot connector.

Configure and schedule ThoughtSpot metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.10/connectors/external-ingestion-deployment.md" /%}

## Requirements

To access the ThoughtSpot APIs and import liveboards, charts, and data models from ThoughtSpot into OpenMetadata, you need appropriate permissions on your ThoughtSpot instance.

{% note %}
- The minimum required role is typically "Developer" or higher, depending on your ThoughtSpot security model.
- For lineage extraction, ensure TML (ThoughtSpot Modeling Language) export is enabled for your user.
{% /note %}

### Python Requirements

{% partial file="/v1.10/connectors/python-requirements.md" /%}

To run the ThoughtSpot ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[thoughtspot]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/thoughtSpotConnection.json)
you can find the structure to create a connection to ThoughtSpot.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following

### 1. Define the YAML Config

This is a sample config for ThoughtSpot:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**hostPort**: URL or IP address of your ThoughtSpot instance.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**authentication**: Choose one of the following authentication methods:
- **Basic Authentication:**
  - username: The ThoughtSpot username
  - password: The ThoughtSpot password
- **API Token Authentication:**
  - apiToken: The ThoughtSpot API token

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**apiVersion**: (Optional) ThoughtSpot API version. Supported: v1, v2. Default: v2

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**orgId**: (Optional) Organization ID for multi-tenant ThoughtSpot Cloud instances.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

- **dbServicePrefixes**: Database Service Names for ingesting lineage if the source supports it.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=7 %}

To send the metadata to OpenMetadata, specify `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.10/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: thoughtspot
  serviceName: local_thoughtspot
  serviceConnection:
    config:
      type: ThoughtSpot
      hostPort: https://my-company.thoughtspot.cloud
      # Choose one authentication method:
      authentication:
        username: myuser
        password: mypassword
      # authentication:
      #   apiToken: my_api_token
      # apiVersion: v2
      # orgId: my-org-id

sourceConfig:
  config:
    type: DashboardMetadata
    lineageInformation:
        dbServicePrefixes: ["mysql", "mssql"]

sink:
  type: metadata-rest
  config: {}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

{% /codeBlock %}

{% /codePreview %}

## Securing ThoughtSpot Connection with SSL in OpenMetadata

{% partial file="/v1.10/connectors/yaml/ingestion-cli.md" /%}
