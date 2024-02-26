---
title: Nifi
slug: /connectors/pipeline/nifi
---

{% connectorDetailsHeader
name="Nifi"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Pipelines"]
unavailableFeatures=["Pipeline Status", "Owners", "Tags", "Lineage"]
/ %}

In this section, we provide guides and references to use the Nifi connector.

Configure and schedule Nifi metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/pipeline/nifi/yaml"} /%}

## Requirements

### Metadata
OpenMetadata supports 2 types of connection for the Nifi connector:
- **basic authentication**: use username/password to authenticate to Nifi. 
- **client certificate authentication**: use CA, client certificate and client key files to authenticate.

The user should be able to send request to the Nifi API and access the `Resources` endpoint.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Nifi", 
    selectServicePath: "/images/v1.3/connectors/nifi/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/nifi/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/nifi/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: Pipeline Service Management/UI URI. This should be specified as a string in the format 'hostname:port'.  

- **Nifi Config**: OpenMetadata supports username/password or client certificate authentication.
    1. Basic Authentication
        - Username: Username to connect to Nifi. This user should be able to send request to the Nifi API and access the `Resources` endpoint.
        - Password: Password to connect to Nifi.
        - Verify SSL: Whether SSL verification should be perform when authenticating.
    2. Client Certificate Authentication
        - Certificate Authority Path: Path to the certificate authority (CA) file. This is the certificate used to store and issue your digital certificate. This is an optional parameter. If omitted SSL verification will be skipped; this can present some sever security issue.
        **important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
        - Client Certificate Path: Path to the certificate client file.
        **important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.
        - Client Key Path: Path to the client key file.
        **important**: This file should be accessible from where the ingestion workflow is running. For example, if you are using OpenMetadata Ingestion Docker container, this file should be in this container.

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/pipeline/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}
