---
title: SAP ERP
slug: /connectors/database/sap-erp
---

{% connectorDetailsHeader
name="SAP ERP"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Stored Procedures", "Owners", "Tags","Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "dbt"]
/ %}


In this section, we provide guides and references to use the SAP ERP connector.

Configure and schedule SAP ERP metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/sap-erp/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/sap-erp/connections) user credentials with the SAP-ERP connector.

## Requirements

To ingest the SAP ERP metadata, CDS Views and OData services need to be setup to efficiently expose SAP data. To achieve this, data must be exposed via RESTful interfaces.
Follow the guide [here](/connectors/database/sap-erp/setup-sap-apis) to setup the APIs.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SAP ERP", 
    selectServicePath: "/images/v1.7/connectors/sap-erp/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/sap-erp/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/sap-erp/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}

{% partial file="/v1.7/connectors/database/related.md" /%}
