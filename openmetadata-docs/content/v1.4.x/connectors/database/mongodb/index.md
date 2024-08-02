---
title: MongoDB
slug: /connectors/database/mongodb
---

{% connectorDetailsHeader
name="MongoDB"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler",]
unavailableFeatures=["Query Usage", "Data Quality", "dbt", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the MongoDB connector.

Configure and schedule MongoDB metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Enable Security](#securing-mongo-connection-with-ssl-in-openmetadata)

{% partial file="/v1.4/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/mongodb/yaml"} /%}

## Requirements

To fetch the metadata from MongoDB to OpenMetadata, the MongoDB user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.

## Metadata Ingestion

{% partial 
  file="/v1.4/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "MongoDB", 
    selectServicePath: "/images/v1.4/connectors/mongodb/select-service.png",
    addNewServicePath: "/images/v1.4/connectors/mongodb/add-new-service.png",
    serviceConnectionPath: "/images/v1.4/connectors/mongodb/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to Mongodb. This user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.
- **Password**: Password to connect to MongoDB.
- **Host Port**: The hostPort parameter specifies the host and port of the MongoDB. This should be specified as a string in the format `hostname:port`. E.g., `localhost:27017`.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

{% partial file="/v1.4/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.4/connectors/test-connection.md" /%}

{% partial file="/v1.4/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.4/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Mongo Connection with SSL in OpenMetadata

To configure SSL for secure connections between OpenMetadata and a Mongo database, add the `ssl_certfile` key with the path to the certificate file as its value, and include the `ssl_keyfile` key with the path to the key file as its value in the Connection Options. Ensure that both the certificate and key files are accessible by the server. If deploying via Docker or Kubernetes, make sure to update the OpenMetadata server to reflect these changes, ensuring that the files are correctly referenced.

{% image
  src="/images/v1.4/connectors/ssl_mongo.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.4/connectors/troubleshooting.md" /%}

{% partial file="/v1.4/connectors/database/related.md" /%}

## Data Profiler

{%inlineCallout icon="description" bold="OpenMetadata 1.3.1 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

[Profiler deployment](/how-to-guides/data-quality-observability/profiler/workflow)

### Limitations

The MongodDB data profiler current supports only the following features:

1. **Row count**: The number of rows in the collection. Sampling or custom query is not supported.
2. **Sample data:** If a custom query is defined it will be used for sample data.
