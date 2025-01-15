---
title: Teradata
slug: /connectors/database/teradata
---

{% connectorDetailsHeader
name="Teradata"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "View Lineage", "View Column-level Lineage"]
unavailableFeatures=["Query Usage", "Data Quality", "Owners", "Tags", "Stored Procedures", "dbt"]
/ %}

In this section, we provide guides and references to use the Teradata connector.

Configure and schedule Teradata metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality/configure)

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/greenplum/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/teradata/connections) user credentials with the Teradata connector.

## Requirements
{%inlineCallout icon="description" bold="OpenMetadata 1.5 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

Connector was tested on Teradata DBS version 17.20. Since there are no significant changes in metadata objects, so it should work with 15.x, 16.x versions.


## Metadata Ingestion

By default, all valid users in Teradata DB has full access to metadata objects, so there are no any specific requirements to user privileges.

{% partial 
  file="/v1.5/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Teradata", 
    selectServicePath: "/images/v1.5/connectors/teradata/select-service.png",
    addNewServicePath: "/images/v1.5/connectors/teradata/add-new-service.png",
    serviceConnectionPath: "/images/v1.5/connectors/teradata/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.5/connectors/troubleshooting.md" /%}

{% partial file="/v1.5/connectors/database/related.md" /%}
