---
title: Grafana Connector | OpenMetadata Integration Guide
description: Learn how to configure and use the Grafana connector in OpenMetadata. Includes setup, authentication, metadata ingestion, and lineage.
slug: /connectors/dashboard/grafana
---

{% connectorDetailsHeader
name="Grafana"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Dashboards", "Charts", "Owners", "Tags", "Lineage"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Grafana connector.

Configure and schedule Grafana metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)


{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/grafana/yaml"} /%}

## Requirements

To access the Grafana APIs and import dashboards and panels into OpenMetadata, you need a Service Account Token with sufficient permissions (Admin role is recommended) and API access enabled on your Grafana instance.

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Grafana", 
    selectServicePath: "/images/v1.9/connectors/grafana/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/grafana/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/grafana/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

Enable debug logging to troubleshoot issues:

```bash
export LOG_LEVEL=DEBUG
```
