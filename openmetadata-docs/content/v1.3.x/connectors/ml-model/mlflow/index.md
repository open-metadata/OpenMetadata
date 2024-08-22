---
title: MLflow
slug: /connectors/ml-model/mlflow
---

{% connectorDetailsHeader
name="MLflow"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["ML Store"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the MLflow connector.

Configure and schedule MLflow metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/ml-model/mlflow/yaml"} /%}

## Requirements

To extract metadata, OpenMetadata needs two elements:
- **Tracking URI**: Address of local or remote tracking server. More information on the MLflow documentation [here](https://www.mlflow.org/docs/latest/tracking.html#where-runs-are-recorded)
- **Registry URI**: Address of local or remote model registry server.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Mlflow", 
    selectServicePath: "/images/v1.3/connectors/mlflow/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/mlflow/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/mlflow/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **trackingUri**: Mlflow Experiment tracking URI. E.g., http://localhost:5000
- **registryUri**: Mlflow Model registry backend. E.g., mysql+pymysql://mlflow:password@localhost:3307/experiments

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/ml-model/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
