---
title: Run the PowerBI Report Server Connector Externally
description: Connect Power BI Report Server to `brandName` with our comprehensive connector guide. Step-by-step setup, configuration, and metadata extraction instructions.
slug: /connectors/dashboard/powerbireportserver
---

{% connectorDetailsHeader
  name="PowerBI Report Server"
  stage="BETA"
  platform="Collate"
  availableFeatures=["Dashboards"]
  unavailableFeatures=["Owners", "Tags", "Charts", "Datamodels", "Projects", "Lineage"]
/ %}

In this section, we provide guides and references to use the PowerBI Report Server connector.

Configure and schedule PowerBI Report Server metadata from CLI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/dashboard/powerbireportserver/troubleshooting)

{% partial file="/v1.8/connectors/external-ingestion-deployment.md" /%}

## Requirements

The PowerBI Report Server should be accessible from the ingestion environment.

## Metadata Ingestion

{% partial 
  file="/v1.8/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "PowerBIReportServer", 
    selectServicePath: "/images/v1.8/connectors/powerbireportserver/select-service.png",
    addNewServicePath: "/images/v1.8/connectors/powerbireportserver/add-new-service.png",
    serviceConnectionPath: "/images/v1.8/connectors/powerbireportserver/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

**Host and Port**:
This parameter specifies the host and port of the Metabase instance. This should be specified as a URI string in the format `http://hostname:port` or `https://hostname:port`. 
For example, you might set it to `http://192.168.1.1:80`.

**Username**:
Username to connect to PowerBI Report Server.

**Password**:
Password to connect to PowerBI Report Server.

**Web Portal Virtual Directory Name**
Web Portal Virtual Directory name which you have configured in your PowerBI Report Server configuration manager.

{% /extraContent %}

{% partial file="/v1.8/connectors/test-connection.md" /%}

{% partial file="/v1.8/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.8/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
