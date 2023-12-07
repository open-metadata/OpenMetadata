---
title: SAS
slug: /connectors/metadata/sas
---

# SAS

{% partial file="/v1.2/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/metadata/sas/yaml"} /%}

## Requirements

## 1. SAS Metadata Ingestion

Prepare the SAS Service and configure the Ingestion:

{% partial 
  file="/v1.2/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SAS", 
    selectServicePath: "/images/v1.2/connectors/sas/select-service.png",
    addNewServicePath: "/images/v1.2/connectors/sas/add-new-service.png",
    serviceConnectionPath: "/images/v1.2/connectors/sas/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **ServerHost**: Host and port of the SAS Viya deployment.
- **Username**: Username to connect to SAS Viya. This user should have privileges to read all the metadata in SAS Information Catalog.
- **Password**: Password to connect to SAS Viya.
- **Filter**: A filter expression specifying items for import. For more information see https://developer.sas.com/apis/rest/DataManagement/#catalog

{% /extraContent %}

{% partial file="/v1.2/connectors/test-connection.md" /%}

{% partial file="/v1.2/connectors/metadata/configure-ingestion.md" /%}

{% partial file="/v1.2/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.2/connectors/troubleshooting.md" /%}
