---
title: Couchbase
slug: /connectors/database/couchbase
---

# Couchbase

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="cross" /%} |
| Data Profiler      | {% icon iconName="cross" /%} |
| Data Quality       | {% icon iconName="cross" /%} |
| Stored Procedures            | {% icon iconName="cross" /%} |
| DBT                | {% icon iconName="check" /%} |
| Supported Versions | --                           |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | {% icon iconName="cross" /%}          |
| Table-level  | {% icon iconName="cross" /%} |
| Column-level | {% icon iconName="cross" /%} |

{% /multiTablesWrapper %}


In this section, we provide guides and references to use the Couchbase connector.

Configure and schedule Couchbase metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/couchbase/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

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
