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

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/couchbase/yaml"} /%}

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Couchbase", 
    selectServicePath: "/images/v1.3/connectors/couchbase/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/couchbase/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/couchbase/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to Couchbase.
- **Password**: Password to connect to Couchbase.
- **Hostport**: If couchbase is hosted on cloud then the hostport parameter specifies the connection string and if you are using couchbase server then the hostport parameter specifies hostname of the Couchbase. This should be specified as a string in the format `hostname` or `xyz.cloud.couchbase.com`. E.g., `localhost`.
- **bucketName**: Optional name to give to the bucket in OpenMetadata. If left blank, If left blank, we will ingest all the bucket names.

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
