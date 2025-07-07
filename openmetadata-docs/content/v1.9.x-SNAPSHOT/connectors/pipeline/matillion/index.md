---
title: Matillion | Collate Docs
description: Get started with Collate's matillion. Setup instructions, features, and configuration details inside.
slug: /connectors/pipeline/matillion
collate: true
---

{% connectorDetailsHeader
name="Matillion"
stage="PROD"
platform="Collate"
availableFeatures=["Pipelines", "Lineage"]
unavailableFeatures=["Owners", "Tags", "Pipeline Status"]
/ %}


In this section, we provide guides and references to use the Matillion connector.

Configure and schedule Matillion metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
    - [Matillion Versions](#matillion-versions)
- [Metadata Ingestion](#metadata-ingestion)
    - [Connection Details](#connection-details)
- [Troubleshooting](/connectors/pipeline/matillion/troubleshooting)
    - [Workflow Deployment Error](#workflow-deployment-error)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/matillion/yaml"} /%}

## Requirements
To extract metadata from Matillion, you need to create a user with the following permissions:

- `API` Permission ( While Creating the User, from Admin -> User )
- To retrieve lineage data, the user must be granted [Component-level permissions](https://docs.matillion.com/metl/docs/2932106/#component).
- To enable lineage tracking in Matillion, **Matillion Enterprise Mode** is required. For detailed setup instructions and further information, refer to the official documentation: [Matillion Lineage Documentation](https://docs.matillion.com/metl/docs/2881895/).

### Matillion Versions

OpenMetadata is integrated with matillion up to version [1.75.0](https://docs.matillion.io/getting-started).

## Metadata Ingestion

{% partial 
    file="/v1.9/connectors/metadata-ingestion-ui.md" 
    variables={
        connector: "Matillion", 
        selectServicePath: "/images/v1.9/connectors/matillion/select-service.webp",
        addNewServicePath: "/images/v1.9/connectors/matillion/add-new-service.webp",
        serviceConnectionPath: "/images/v1.9/connectors/matillion/service-connection.webp",
    } 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **hostPort**: The hostname or IP address with the REST API enabled eg.`https://<your-matillion-host-name-here>`

- **username**: The username to authenticate with the Matillion instance.

- **password**: The password to authenticate with the Matillion instance.

- **caCertificate** : CA Certificate to authenticate with the Matillion instance.

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

By successfully completing these steps, the lineage information for the service will be displayed.

{% image
  src="/images/v1.9/connectors/matillion/lineage.webp"
  alt="Matillion Lineage" /%}
