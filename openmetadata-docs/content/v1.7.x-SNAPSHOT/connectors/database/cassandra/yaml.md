---
title: Run the Cassandra Connector Externally
slug: /connectors/database/cassandra/yaml
---

{% connectorDetailsHeader
name="Cassandra"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Quality", "dbt", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures","Data Profiler"]
/ %}

In this section, we provide guides and references to use the Cassandra connector.

Configure and schedule Cassandra metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/cassandra/yaml"} /%}

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

To extract metadata using the Cassandra connector, ensure the user in the connection has the following permissions:
- Read Permissions: The ability to query tables and perform data extraction.
- Schema Operations: Access to list and describe keyspaces and tables.


### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

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

{% codeInfo srNumber=3 %}

**hostPort**: When using the `cassandra` connecion schema, the hostPort parameter specifies the host and port of the Cassandra. This should be specified as a string in the format `hostname:port`. E.g., `localhost:9042`.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**Auth Type**: Following authentication types are supported:
1. **Basic Authentication**:
We'll use the user credentials to connect to Cassandra
- **password**: Password of the user.

2. **DataStax Astra DB Configuration**: 
Configuration for connecting to DataStax Astra DB in the cloud.
  - **secureConnectBundle**: File path to the Secure Connect Bundle (.zip) used for a secure connection to DataStax Astra DB.
  - **token**: The Astra DB application token used for authentication.
  - **connectTimeout**: Timeout in seconds for establishing new connections to Cassandra.
  - **requestTimeout**: Timeout in seconds for individual Cassandra requests.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

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
```yaml {% srNumber=3 %}
      hostPort: localhost:9042
```
```yaml {% srNumber=4 %}
      databaseName: custom_database_name
```
```yaml {% srNumber=5 %}
      authType:
        password: password
        cloudConfig:
          secureConnectBundle: <SCB File Path>
          token: <Token String>
          requestTimeout: <Timeout in seconds>
          connectTimeout: <Timeout in seconds>
```


{% partial file="/v1.7/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}
