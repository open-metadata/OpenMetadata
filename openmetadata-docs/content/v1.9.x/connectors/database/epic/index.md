---
title: Epic FHIR Connector | OpenMetadata Healthcare Integration Guide
description: Connect Epic FHIR to OpenMetadata to automatically discover, catalog, and manage your Epic FHIR metadata. Step-by-step configuration guide.
slug: /connectors/database/epic
Collate: true
---

{% connectorDetailsHeader
name="Epic FHIR"
stage="BETA"
platform="Collate"
availableFeatures=["Metadata"]
unavailableFeatures=["Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Query Usage", "Owners", "Tags", "Sample Data", "Reverse Metadata (Collate Only)", "Auto-Classification", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Epic FHIR connector.

Configure and schedule Epic metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/epic/yaml"} /%}

## Requirements

To fetch metadata from Epic FHIR into OpenMetadata you will need:

1. An accessible Epic FHIR base URL (e.g. `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR`).
2. The FHIR version supported by your Epic server. Supported values are: `R4`, `STU3`, and `DSTU2`.

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Epic FHIR", 
    selectServicePath: "/images/v1.9/connectors/epic/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/epic/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/epic/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **FHIR Server URL**: Base URL of the Epic FHIR server.
- **FHIR Version**: FHIR specification version supported by the server (`R4`, `STU3`, or `DSTU2`).
- **Database Name**: Optional; name that will be shown inside OpenMetadata. Defaults to `epic`.

{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.9/connectors/database/related.md" /%}
