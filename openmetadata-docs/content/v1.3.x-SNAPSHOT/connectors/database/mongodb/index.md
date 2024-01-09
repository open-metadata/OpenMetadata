---
title: MongoDB
slug: /connectors/database/mongodb
---

# MongoDB

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

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/mongodb/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To fetch the metadata from MongoDB to OpenMetadata, the MongoDB user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "MongoDB", 
    selectServicePath: "/images/v1.3/connectors/mongodb/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/mongodb/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/mongodb/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to Mongodb. This user must have access to perform `find` operation on collection and `listCollection` operations on database available in MongoDB.
- **Password**: Password to connect to MongoDB.
- **Host Port**: The hostPort parameter specifies the host and port of the MongoDB. This should be specified as a string in the format `hostname:port`. E.g., `localhost:27017`.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
