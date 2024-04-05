---
title: Run the Atlas Connector Externally
slug: /connectors/metadata/atlas/yaml
---

{% connectorDetailsHeader
name="Atlas"
stage="PROD"
platform="OpenMetadata"
availableFeatures=[]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Atlas connector.

Configure and schedule Atlas metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)


{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

Before this, you must ingest the database / messaging service you want to get metadata for. 
For more details click [here](/connectors/metadata/atlas#1.-create-database-&-messaging-services)

### Python Requirements

To run the Atlas ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[atlas]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/atlasConnection.json)
you can find the structure to create a connection to Atlas.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=12 %}

**hostPort**: Atlas Host of the data source.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

**username**: Username to connect to the Atlas. This user should have privileges to read all the metadata in Atlas.

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**password**: Password to connect to the Atlas.

{% /codeInfo %}

{% codeInfo srNumber=15 %}

**databaseServiceName**: source database of the data source(Database service that you created from UI. example- local_hive).

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**messagingServiceName**: messaging service source of the data source.

{% /codeInfo %}

{% codeInfo srNumber=17 %}

**entity_type**: Name of the entity type in Atlas.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=18 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}
{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: Atlas
  serviceName: local_atlas
  serviceConnection:
    config:
      type: Atlas
```
```yaml {% srNumber=12 %}
      hostPort: http://localhost:10000
```
```yaml {% srNumber=13 %}
      username: username
```
```yaml {% srNumber=14 %}
      password: password
```
```yaml {% srNumber=15 %}
      databaseServiceName: ["local_hive"] # create database service and messaging service and pass `service name` here
```
```yaml {% srNumber=16 %}
      messagingServiceName: []
```
```yaml {% srNumber=17 %}
      entity_type: Table
  sourceConfig:
    config:
      type: DatabaseMetadata
```
```yaml {% srNumber=18 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}
