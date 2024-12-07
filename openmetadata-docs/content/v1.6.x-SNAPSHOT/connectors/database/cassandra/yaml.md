---
title: Run the Cassandra Connector Externally
slug: /connectors/database/cassandra/yaml
---

{% connectorDetailsHeader
name="Cassandra"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Quality", "dbt", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures","Data Profiler"]
/ %}

In this section, we provide guides and references to use the Cassandra connector.

Configure and schedule Cassandra metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.6/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/cassandra/yaml"} /%}

{% partial file="/v1.6/connectors/external-ingestion-deployment.md" /%}

## Requirements

To extract metadata using the Cassandra connector, ensure the user in the connection has the following permissions:
- Read Permissions: The ability to query tables and perform data extraction.
- Schema Operations: Access to list and describe keyspaces and tables.


### Python Requirements

{% partial file="/v1.6/connectors/python-requirements.md" /%}

To run the Cassandra ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[cassandra]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/cassandraConnection.json)
you can find the structure to create a connection to Cassandra.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Cassandra:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Username to connect to Cassandra. This user must have the necessary permissions to perform metadata extraction and table queries.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Cassandra.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: When using the `cassandra` connecion schema, the hostPort parameter specifies the host and port of the Cassandra. This should be specified as a string in the format `hostname:port`. E.g., `localhost:9042`.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

{% /codeInfo %}

{% partial file="/v1.6/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.6/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.6/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=5 %}

**cloudConfig**: Configuration for connecting to DataStax Astra DB in the cloud.

{% /codeInfo %}


{% /codeInfoContainer %}

{% codeBlock fileName="cassandra.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: cassandra
  serviceName: local_cassandra
  serviceConnection:
    config:
      type: Cassandra
```
```yaml {% srNumber=1 %}
      username: username
```
```yaml {% srNumber=2 %}
      password: password
```
```yaml {% srNumber=3 %}
      hostPort: localhost:9042
```
```yaml {% srNumber=4 %}
      databaseName: custom_database_name
```
```yaml {% srNumber=5 %}
      cloudConfig:
        secureConnectBundle: <file path>
        token: token
        requestTimeout: 600
        connectTimeout: 600
```


{% partial file="/v1.6/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.6/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.6/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.6/connectors/yaml/ingestion-cli.md" /%}


### 1. Define the YAML Config

This is a sample config for the profiler:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=20 %}

#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json).


**schemaFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=21 %}

**tableFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}


{% codeInfo srNumber=23 %}

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.
{% /codeInfo %}


{% codeInfo srNumber=24 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% isCodeBlock=true %}
source:
  type: cassandra
  serviceName: local_cassandra
  sourceConfig:
    config:
      type: DatabaseMetadata
```

```yaml {% srNumber=20 %}
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
```
```yaml {% srNumber=21 %}
      # tableFilterPattern:
      #   includes:
      #     - table1
      #     - table2
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=23 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=24 %}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

{% /codeBlock %}

{% /codePreview %}

## dbt Integration

{% tilesContainer %}

{% tile
icon="mediation"
title="dbt Integration"
description="Learn more about how to ingest dbt models' definitions and their lineage."
link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}

