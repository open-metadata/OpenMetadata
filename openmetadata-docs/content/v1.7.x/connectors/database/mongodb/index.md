---
title: MongoDB Connector | OpenMetadata NoSQL Database Integration
description: Connect MongoDB to OpenMetadata with our comprehensive database connector guide. Step-by-step setup, configuration, and metadata extraction for seamless integration.
slug: /connectors/database/mongodb
---

{% connectorDetailsHeader
name="MongoDB"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Sample Data"]
unavailableFeatures=["Query Usage", "Data Quality", "dbt", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the MongoDB connector.

Configure and schedule MongoDB metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Troubleshooting](/connectors/database/mongodb/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/mongodb/yaml"} /%}

## Requirements

To fetch the metadata from MongoDB to OpenMetadata, the MongoDB user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "MongoDB", 
    selectServicePath: "/images/v1.7/connectors/mongodb/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/mongodb/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/mongodb/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to Mongodb. This user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.
- **Password**: Password to connect to MongoDB.
- **Host Port**: When using the `mongodb` connecion schema, the hostPort parameter specifies the host and port of the MongoDB. This should be specified as a string in the format `hostname:port`. E.g., `localhost:27017`. When using the `mongodb+srv` connection schema, the hostPort parameter specifies the host and port of the MongoDB. This should be specified as a string in the format `hostname`. E.g., `cluster0-abcde.mongodb.net`.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

Using Atlas? Follow [this guide](https://www.mongodb.com/docs/guides/atlas/connection-string/) to get the connection string.

{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/database/related.md" /%}

## Data Profiler

{%inlineCallout icon="description" bold="OpenMetadata 1.3.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

[Profiler deployment](/how-to-guides/data-quality-observability/profiler/workflow)

### Limitations

The MongodDB data profiler current supports only the following features:

1. **Row count**: The number of rows in the collection. Sampling or custom query is not supported.
2. **Sample data:** If a custom query is defined it will be used for sample data.
