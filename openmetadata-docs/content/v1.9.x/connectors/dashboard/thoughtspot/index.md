---
title: ThoughtSpot Connector | `brandName` Integration Guide
description: Learn how to configure and use the ThoughtSpot connector in OpenMetadata. Includes setup, authentication, API access, metadata ingestion, and lineage.
slug: /connectors/dashboard/thoughtspot
collate: true
---

{% connectorDetailsHeader
name="ThoughtSpot"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Dashboards", "Charts", "Owners", "Datamodels", "Lineage"]
unavailableFeatures=["Projects"]
/ %}

In this section, we provide guides and references to use the ThoughtSpot connector.

Configure and schedule ThoughtSpot metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Connection Details](#connection-details)
- [Metadata Ingestion](#metadata-ingestion)
- [Lineage](#lineage)
- [Troubleshooting](/connectors/dashboard/thoughtspot/troubleshooting)

{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/thoughtspot/yaml"} /%}

## Requirements

To access the ThoughtSpot APIs and import liveboards, charts, and data models from ThoughtSpot into OpenMetadata, you need appropriate permissions on your ThoughtSpot instance.

### ThoughtSpot Account Setup and Permissions

1. **Authentication Setup**  
   ThoughtSpot supports multiple authentication methods:
   - **Basic Authentication:** Username and password authentication. The user should have appropriate permissions to read metadata from ThoughtSpot.
   - **API Token Authentication:** Use ThoughtSpot API tokens for authentication. Generate API tokens from your ThoughtSpot instance.

2. **API Permissions**  
   Ensure your ThoughtSpot user or service account has the following permissions:
   - Read access to liveboards and answers
   - Read access to worksheets and data models
   - Access to metadata APIs
   - Export permissions for TML (ThoughtSpot Modeling Language) data

3. **Multi-tenant Configuration (Optional)**  
   If you're using ThoughtSpot Cloud with multiple organizations:
   - Set the `Organization ID` parameter to specify which organization to connect to (only for ThoughtSpot Cloud).

{% note %}
- For lineage extraction, ensure TML (ThoughtSpot Modeling Language) export is enabled for your user.
{% /note %}

## Connection Details

- **Host and Port:**  
  The URL of your ThoughtSpot instance.  
  Examples:  
  - Cloud: `https://my-company.thoughtspot.cloud`  
  - On-premise: `https://thoughtspot.company.com`  
  - Local: `https://localhost`  
  If running ingestion in Docker and ThoughtSpot is on `localhost`, use `host.docker.internal`.

- **Authentication:**  
  Choose one of the following:
  - **Basic Authentication:**  
    - Username: Your ThoughtSpot username  
    - Password: Your ThoughtSpot password
  - **API Token Authentication:**  
    - API Token: Your ThoughtSpot API token

- **API Version:**  
  The ThoughtSpot API version to use for metadata extraction.  
  - `v1`: Legacy API version (callosum endpoints)  
  - `v2`: Current API version (recommended, default)

- **Organization ID:**  
  For multi-tenant ThoughtSpot Cloud deployments.  
  - Leave empty for single-tenant  
  - Set to your org ID for multi-tenant

## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "ThoughtSpot", 
    selectServicePath: "/images/v1.8/connectors/thoughtspot/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/thoughtspot/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/thoughtspot/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

**Note:**  
Lineage creation requires:
- Database service names to be configured in the lineage information
- Access to TML export functionality

Enable debug logging to troubleshoot issues:
```bash
export LOG_LEVEL=DEBUG
```

This will provide detailed information about API calls, data extraction, and lineage creation.
