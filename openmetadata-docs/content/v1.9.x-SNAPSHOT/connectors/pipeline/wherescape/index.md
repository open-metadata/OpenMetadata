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

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Connection Details](#connection-details)
- [Troubleshooting](/connectors/pipeline/wherescape/troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/wherescape/yaml"} /%}

## Requirements
To extract Wherescape metadata, we need the batabase connection details where the metadata is stored.

- `API` Permission ( While Creating the User, from Admin -> User )
- To retrieve lineage data, the user must be granted [Component-level permissions](https://docs.matillion.com/metl/docs/2932106/#component).
- To enable lineage tracking in Matillion, **Matillion Enterprise Mode** is required. For detailed setup instructions and further information, refer to the official documentation: [Matillion Lineage Documentation](https://docs.matillion.com/metl/docs/2881895/).

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Wherescape", 
    selectServicePath: "/images/v1.9/connectors/wherescape/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/wherescape/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/wherescape/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Connection**: Wherescape metadata database connection.

In terms of `connection` we support the following selections:

- **Microsoft SQL Server**: To connect to the Wherescape metadata database:
  - Provide the SQL Server connection credentials including username and password
  - Specify the database name where Wherescape metadata is stored
  - Enter the host and port for the SQL Server instance
  - The connector will establish a connection to this database to extract Wherescape pipeline metadata

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}
