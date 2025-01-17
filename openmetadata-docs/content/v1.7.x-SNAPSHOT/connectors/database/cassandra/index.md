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

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/cassandra/connections) user credentials with the Cassandra connector.

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

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
