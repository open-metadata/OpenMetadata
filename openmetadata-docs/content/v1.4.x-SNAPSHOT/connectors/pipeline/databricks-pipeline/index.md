---
title: Databricks Pipeline
slug: /connectors/pipeline/databricks-pipeline
---

{% connectorDetailsHeader
name="Databricks"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines", "Pipeline Status"]
unavailableFeatures=["Owners", "Tags", "Lineage"]
/ %}

In this section, we provide guides and references to use the Databricks Pipeline connector.

Configure and schedule Databricks Pipeline metadata workflows from the OpenMetadata UI:

- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/databricks-pipeline/yaml"} /%}

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Databricks Pipeline", 
    selectServicePath: "/images/v1.3/connectors/databrickspipeline/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/databrickspipeline/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/databrickspipeline/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: Enter the fully qualified hostname and port number for your Databricks Pipeline deployment in the Host and Port field.
- **Token**: Generated Token to connect to Databricks Pipeline.
- **HTTP Path**: Databricks Pipeline compute resources URL.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Databricks during the connection. These details must be added as Key-Value pairs.
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
