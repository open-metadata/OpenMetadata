---
title: SSAS Connector | OpenMetadata SQL Server Integration Guide
slug: /connectors/database/ssas
collate: true
---

{% connectorDetailsHeader
name="SSAS"
stage="BETA"
platform="Collate"
availableFeatures=["Metadata", "Lineage"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the SSAS connector.

Configure and schedule SSAS metadata and profiler workflows from the Collate UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Connection Details](#connection-details)
- [Troubleshooting](/connectors/database/ssas/troubleshooting)


{% partial file="/v1.8/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/ssas/yaml"} /%}

## Requirements
To extract metadata from SSAS, ensure the following requirements are met:

- **HTTP Access**: The SSAS service must be accessible via HTTP. You need to grant HTTP access to the SSAS instance.
- **Authentication**: HTTP access should be secured using Basic Authentication. Make sure you have a valid username and password with sufficient privileges to access the required models.
- **Model Deployment**: The SSAS models you want to ingest must be deployed and available in the SSAS instance.
- **Documentation**: For detailed steps on enabling HTTP access and configuring authentication for SSAS, please refer to the official SSAS documentation: [SSAS HTTP Access Guide](https://learn.microsoft.com/en-us/analysis-services/instances/configure-http-access-to-analysis-services-on-iis-8-0?view=sql-analysis-services-2025)

These steps are necessary to allow the connector to communicate with your SSAS instance and retrieve metadata successfully.


## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "SSAS", 
    selectServicePath: "/images/v1.8/connectors/ssas/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/ssas/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/ssas/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **HTTP Connection**: The HTTP endpoint (URL) for accessing your SSAS instance. This should be the address where your SSAS service is exposed for HTTP requests.
- **Username**: The username for authenticating to the SSAS HTTP endpoint. This user must have sufficient privileges to access the required models and metadata.
- **Password**: The password for the above username. The password is stored securely and used for Basic Authentication.

**Example Connection JSON:**


{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

