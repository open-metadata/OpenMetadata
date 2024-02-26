---
title: Run the Metabase Connector Externally
slug: /connectors/dashboard/metabase/yaml
---

{% connectorDetailsHeader
  name="Metabase"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Lineage", "Projects"]
  unavailableFeatures=["Owners", "Tags", "Datamodels"]
/ %}

In this section, we provide guides and references to use the Metabase connector.

Configure and schedule Metabase metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

**Note:** We have tested Metabase with Versions `0.42.4` and `0.43.4`.

### Python Requirements

To run the Metabase ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[metabase]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/metabaseConnection.json)
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

**username**: Username to connect to Metabase, for ex. `user@organization.com`. This user should have access to relevant dashboards and charts in Metabase to fetch the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password of the user account to connect with Metabase.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: The hostPort parameter specifies the host and port of the Metabase instance. This should be specified as a string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set the hostPort parameter to `https://org.metabase.com:3000`.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/dashboard/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}


{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: metabase
  serviceName: <service name>
  serviceConnection:
    config:
      type: Metabase
```
```yaml {% srNumber=1 %}
      username: <username>
```
```yaml {% srNumber=2 %}
      password: <password>
```
```yaml {% srNumber=3 %}
      hostPort: <hostPort>
```

{% partial file="/v1.3/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
