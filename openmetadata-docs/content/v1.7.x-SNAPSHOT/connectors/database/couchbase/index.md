---
title: Couchbase
slug: /connectors/database/couchbase
---

{% connectorDetailsHeader
name="Couchbase"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "dbt"]
/ %}


In this section, we provide guides and references to use the Couchbase connector.

Configure and schedule Couchbase metadata workflows from the OpenMetadata UI:

- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/couchbase/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/couchbase/connections) user credentials with the Couchbase connector.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Couchbase", 
    selectServicePath: "/images/v1.7/connectors/couchbase/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/couchbase/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/couchbase/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
