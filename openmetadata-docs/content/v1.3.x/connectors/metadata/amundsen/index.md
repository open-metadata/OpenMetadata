---
title: Amundsen
slug: /connectors/metadata/amundsen
---

{% connectorDetailsHeader
name="Amundsen"
stage="PROD"
platform="OpenMetadata"
availableFeatures=[]
unavailableFeatures=[]
/ %}

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/metadata/amundsen/yaml"} /%}

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Amundsen", 
    selectServicePath: "/images/v1.3/connectors/amundsen/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/amundsen/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/amundsen/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **username**: Enter the username of your Amundsen user in the Username field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow.
- **password**: Enter the password for your amundsen user in the Password field.
- **hostPort**: Host and port of the Amundsen Neo4j Connection. This expect a URI format like: bolt://localhost:7687.
- **maxConnectionLifeTime (optional)**: Maximum connection lifetime for the Amundsen Neo4j Connection 
- **validateSSL (optional)**: Enable SSL validation for the Amundsen Neo4j Connection. 
- **encrypted (Optional)**: Enable encryption for the Amundsen Neo4j Connection. 

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/metadata/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
