---
title: Atlas
slug: /connectors/metadata/atlas
---

{% connectorDetailsHeader
name="Atlas"
stage="PROD"
platform="OpenMetadata"
availableFeatures=[]
unavailableFeatures=[]
/ %}

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/metadata/atlas/yaml"} /%}

## Requirements

{% note %}
Every table ingested will have a tag name `AtlasMetadata.atlas_table`. You can find all tags under
Governance > Classification.
{% /note %}

## 1. Create Database & Messaging Services

You need to create at least a Database Service before ingesting the metadata from Atlas. Make sure to note down the name, since
we will use it to create Atlas Service.

For example, to create a Hive Service you can follow these steps:

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Hive", 
    selectServicePath: "/images/v1.3/connectors/hive/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/hive/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/hive/service-connection.png",
} 
/%}

## 2. Atlas Metadata Ingestion

Then, prepare the Atlas Service and configure the Ingestion:

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Atlas", 
    selectServicePath: "/images/v1.3/connectors/atlas/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/atlas/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/atlas/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: Host and port of the Atlas service.
- **Username**: username to connect  to the Atlas. This user should have privileges to read all the metadata in Atlas.
- **Password**: password to connect  to the Atlas.
- **databaseServiceName**: source database of the data source. This is the service we created before: e.g., `local_hive`)
- **messagingServiceName**: messaging service source of the data source.
- **Entity Type**: Name of the entity type in Atlas.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/metadata/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
