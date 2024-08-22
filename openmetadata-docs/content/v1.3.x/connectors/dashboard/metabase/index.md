---
title: Metabase
slug: /connectors/dashboard/metabase
---

{% connectorDetailsHeader
  name="Metabase"
  stage="PROD"
  platform="OpenMetadata"
  availableFeatures=["Dashboards", "Charts", "Lineage", "Projects"]
  unavailableFeatures=["Owners", "Tags", "Datamodels"]
/ %}

In this section, we provide guides and references to use the Metabase connector.

Configure and schedule Metabase metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/metabase/yaml"} /%}

## Requirements

**Note:** We have tested Metabase with Versions `0.42.4` and `0.43.4`.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Metabase", 
    selectServicePath: "/images/v1.3/connectors/metabase/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/metabase/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/metabase/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: The hostPort parameter specifies the host and port of the Metabase instance. This should be specified as a string in the format `http://hostname:port` or `https://hostname:port`. For example, you might set the hostPort parameter to `https://org.metabase.com:3000`.
- **Username**: Username to connect to Metabase, for ex. `user@organization.com`. This user should have access to relevant dashboards and charts in Metabase to fetch the metadata.
- **Password**: Password of the user account to connect with Metabase.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
