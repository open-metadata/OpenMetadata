---
title: Cassandra
slug: /connectors/database/cassandra
---

{% connectorDetailsHeader
name="Cassandra"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Quality", "dbt", "Owners", "Lineage", "Column-level Lineage", "Tags", "Stored Procedures", "Data Profiler"]
/ %}


In this section, we provide guides and references to use the Cassandra connector.

Configure and schedule Cassandra metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/cassandra/yaml"} /%}

## Requirements

To extract metadata using the Cassandra connector, ensure the user in the connection has the following permissions:
- Read Permissions: The ability to query tables and perform data extraction.
- Schema Operations: Access to list and describe keyspaces and tables.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Cassandra", 
    selectServicePath: "/images/v1.7/connectors/cassandra/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/cassandra/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/cassandra/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to Cassandra. This user must have the necessary permissions to perform metadata extraction and table queries.
- **Host Port**: When using the `cassandra` connecion schema, the hostPort parameter specifies the host and port of the Cassandra. This should be specified as a string in the format `hostname:port`. E.g., `localhost:9042`.- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.

**Auth Type**: Following authentication types are supported:
1. **Basic Authentication**:
We'll use the user credentials to connect to Cassandra
- **password**: Password of the user.

2. **DataStax Astra DB Configuration**: 
Configuration for connecting to DataStax Astra DB in the cloud.
  - **connectTimeout**: Timeout in seconds for establishing new connections to Cassandra.
  - **requestTimeout**: Timeout in seconds for individual Cassandra requests.
  - **token**: The Astra DB application token used for authentication.
  - **secureConnectBundle**: File path to the Secure Connect Bundle (.zip) used for a secure connection to DataStax Astra DB.


{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
