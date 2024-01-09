---
title: Run the MongoDB Connector Externally
slug: /connectors/database/mongodb/yaml
---

# Run the MongoDB Connector Externally

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | BETA                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="cross" /%} |
| Data Profiler      | {% icon iconName="cross" /%} |
| Data Quality       | {% icon iconName="cross" /%} |
| Stored Procedures  | {% icon iconName="cross" /%} |
| DBT                | {% icon iconName="cross" /%} |
| Supported Versions | --                           |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | {% icon iconName="cross" /%} |
| Table-level  | {% icon iconName="cross" /%} |
| Column-level | {% icon iconName="cross" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the MongoDB connector.

Configure and schedule MongoDB metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.2/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/mongodb/yaml"} /%}

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To fetch the metadata from MongoDB to OpenMetadata, the MongoDB user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.

### Python Requirements

To run the MongoDB ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[mongo]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/mongoDBConnection.json)
you can find the structure to create a connection to MongoDB.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for MongoDB:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Username to connect to Mongodb. This user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to MongoDB.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: The hostPort parameter specifies the host and port of the MongoDB. This should be specified as a string in the format `hostname:port`. E.g., `localhost:27017`.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**connectionURI**: MongoDB connection string is a concise string of parameters used to establish a connection between an OpenMetadata and a MongoDB database. For ex. `mongodb://username:password@mongodb0.example.com:27017`.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

{% /codeInfo %}

{% partial file="/v1.2/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.2/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.2/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=7 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}


{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: mongodb
  serviceName: local_mongodb
  serviceConnection:
    config:
      type: MongoDB
      connectionDetails:
```
```yaml {% srNumber=1 %}
        username: username
```
```yaml {% srNumber=2 %}
        password: password
```
```yaml {% srNumber=3 %}
        hostPort: localhost:27017
```
```yaml {% srNumber=5 %}
        # connectionURI: mongodb://username:password@mongodb0.example.com:27017
```
```yaml {% srNumber=7 %}
        # connectionOptions:
        #   key: value
```
```yaml {% srNumber=6 %}
      database: custom_database_name
```

{% partial file="/v1.2/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.2/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.2/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.2/connectors/yaml/ingestion-cli.md" /%}

## dbt Integration

{% tilesContainer %}

{% tile
icon="mediation"
title="dbt Integration"
description="Learn more about how to ingest dbt models' definitions and their lineage."
link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
