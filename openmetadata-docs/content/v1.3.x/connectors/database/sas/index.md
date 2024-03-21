---
title: SAS
slug: /connectors/database/sas
---

{% connectorDetailsHeader
name="SAS"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Stored Procedures", "Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the SAS connector.

Configure and schedule SAS metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/sas/yaml"} /%}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 1.3 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Metadata Ingestion

Prepare the SAS Service and configure the Ingestion:

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SAS", 
    selectServicePath: "/images/v1.3/connectors/sas/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/sas/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/sas/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **ServerHost**: Host and port of the SAS Viya deployment.
- **Username**: Username to connect to SAS Viya. This user should have privileges to read all the metadata in SAS Information Catalog.
- **Password**: Password to connect to SAS Viya.
- **Filter**: A filter expression specifying items for import. For more information [see](https://developer.sas.com/apis/rest/DataManagement/#catalog)

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/metadata/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
