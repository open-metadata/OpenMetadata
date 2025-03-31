---
title: Wherescape
slug: /connectors/pipeline/wherescape
---

{% connectorDetailsHeader
name="Wherescape"
stage="BETA"
platform="Collate"
availableFeatures=["Pipelines", "Pipeline Status", "Lineage", "Owners"]
unavailableFeatures=["Tags"]
/ %}

In this section, we provide guides and references to use the Wherescape connector.

Configure and schedule Wherescape metadata workflow from the OpenMetadata UI:

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/wherescape/yaml"} /%}

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Wherescape", 
    selectServicePath: "/images/v1.7/connectors/wherescape/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/wherescape/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/wherescape/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Connection**: Wherescape metadata database connection.

In terms of `connection` we support the following selections:

- `Mssql`: Pass the required credentials to reach out this service. We
    will create a connection to the pointed database and read Wherescape data from there.

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/troubleshooting.md" /%}
