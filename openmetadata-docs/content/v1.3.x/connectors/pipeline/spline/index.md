---
title: Spline
slug: /connectors/pipeline/spline
---

{% connectorDetailsHeader
name="Spline"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status"]
unavailableFeatures=["Owners", "Tags", "Lineage"]
/ %}


In this section, we provide guides and references to use the Spline connector.

Configure and schedule Spline metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/spline/yaml"} /%}

## Requirements

The Spline connector support lineage of data source of type `jdbc` or `dbfs` i.e. The spline connector would be able to extract lineage if the data source is either a jdbc connection or the data source is databricks instance.

{% note %}

Currently, we do not support data source of type aws s3 or any other cloud storage, which also means that the lineage for external tables from databricks will not be extracted. 

{% /note %}

You can refer [this](https://github.com/AbsaOSS/spline-getting-started/tree/main/spline-on-databricks) documentation on how to configure databricks with spline.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Spline", 
    selectServicePath: "/images/v1.3/connectors/spline/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/spline/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/spline/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Spline REST Server Host & Port**: OpenMetadata uses Spline REST Server APIs to extract the execution details from spline to generate lineage. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8080`, `http://host.docker.internal:8080`.

- **Spline UI Host & Port**: Spline UI Host & Port is an optional field which is used for generating redirection URL from OpenMetadata to Spline Portal. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:9090`, `http://host.docker.internal:9090`.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
