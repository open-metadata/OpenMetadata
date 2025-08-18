---
title: Stitch Connector | Official Documentation
description: Ingest Stitch pipeline metadata to track transformation flow and manage operational lineage.
slug: /connectors/pipeline/stitch
collate: true
---

{% connectorDetailsHeader
name="Stitch"
stage="PROD"
platform="Collate"
availableFeatures=["Pipelines", "Lineage"]
unavailableFeatures=["Owners", "Tags", "Pipeline Status"]
/ %}


In this section, we provide guides and references to use the Stitch connector.

Configure and schedule Stitch metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Troubleshooting](/connectors/pipeline/stitch/troubleshooting)

{% partial file="/v1.10/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/stitch/yaml"} /%}

## Requirements

To extract metadata from Stitch, User first need to crate API crednetials:
- `Token`: Token to access Stitch metadata.


## Metadata Ingestion

{% partial 
    file="/v1.10/connectors/metadata-ingestion-ui.md" 
    variables={
        connector: "Stitch", 
        selectServicePath: "/images/v1.10/connectors/stitch/select-service.png",
        addNewServicePath: "/images/v1.10/connectors/stitch/add-new-service.png",
        serviceConnectionPath: "/images/v1.10/connectors/stitch/service-connection.png",
    } 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **hostPort**: This parameter specifies the network location where your Stitch instance is accessible, combining both the hostname. It is based on the account and region where user has hosted his/her data pipelines. More about this you can check [here](https://www.stitchdata.com/docs/developers/import-api/api#base-urls)

- **token**: Token to get access to Stitch metadata. This token is created by user after logging into stitch console. More about this, please check [here](https://www.stitchdata.com/docs/developers/import-api/guides/quick-start#obtain-api-credentials)


{% /extraContent %}

{% partial file="/v1.10/connectors/test-connection.md" /%}

{% partial file="/v1.10/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.10/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

By successfully completing these steps, the lineage information for the service will be displayed.
