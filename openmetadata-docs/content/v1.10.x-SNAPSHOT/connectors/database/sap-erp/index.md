---
title: SAP ERP Connector | OpenMetadata Enterprise Integration
description: Connect SAP ERP to OpenMetadata with our comprehensive database connector guide. Setup instructions, configuration steps, and metadata extraction tips.
slug: /connectors/database/sap-erp
---

{% connectorDetailsHeader
name="SAP ERP"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Stored Procedures", "Owners", "Tags","Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "dbt", "Sample Data", "Auto-Classification"]
/ %}


In this section, we provide guides and references to use the SAP ERP connector.

Configure and schedule SAP ERP metadata workflow from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/sap-erp/troubleshooting)

{% partial file="/v1.10/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/sap-erp/yaml"} /%}

## Requirements

To ingest the SAP ERP metadata, CDS Views and OData services need to be setup to efficiently expose SAP data. To achieve this, data must be exposed via RESTful interfaces.
Follow the guide [here](/connectors/database/sap-erp/setup-sap-apis) to setup the APIs.

## Metadata Ingestion

{% partial 
  file="/v1.10/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SAP ERP", 
    selectServicePath: "/images/v1.10/connectors/sap-erp/select-service.png",
    addNewServicePath: "/images/v1.10/connectors/sap-erp/add-new-service.png",
    serviceConnectionPath: "/images/v1.10/connectors/sap-erp/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: This parameter specifies the host and port of the SAP ERP instance. This should be specified as a string in the format `https://hostname.com`.
- **API Key**: Api Key to authenticate the SAP ERP Apis.
- **database**: Optional name to give to the database in OpenMetadata. If left blank, we will use `default` as the database name.
- **databaseSchema**: Optional name to give to the database schema in OpenMetadata. If left blank, we will use `default` as the database schema name.
- **paginationLimit**: Pagination limit used while querying the SAP ERP APIs for fetching the entities.

{% partial file="/v1.10/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.10/connectors/test-connection.md" /%}

{% partial file="/v1.10/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.10/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.10/connectors/database/related.md" /%}
