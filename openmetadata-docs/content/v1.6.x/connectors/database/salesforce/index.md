---
title: Salesforce
slug: /connectors/database/salesforce
---

{% connectorDetailsHeader
name="Salesforce"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures", "Owners", "Tags"]
/ %}


In this section, we provide guides and references to use the Salesforce connector.

Configure and schedule Salesforce metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Enable Security](#securing-salesforce-connection-with-ssl-in-openmetadata)

{% partial file="/v1.6/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/salesforce/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/salesforce/connections) user credentials with the Salesforce connector.

## Requirements

These are the permissions you will require to fetch the metadata from Salesforce.

- **API Access**: You must have the API Enabled permission in your Salesforce organization.
- **Object Permissions**: You must have read access to the Salesforce objects that you want to ingest.

## Metadata Ingestion

{% partial 
  file="/v1.6/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Salesforce", 
    selectServicePath: "/images/v1.6/connectors/salesforce/select-service.png",
    addNewServicePath: "/images/v1.6/connectors/salesforce/add-new-service.png",
    serviceConnectionPath: "/images/v1.6/connectors/salesforce/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.6/connectors/test-connection.md" /%}

{% partial file="/v1.6/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.6/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Salesforce Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and Salesforce, navigate to the `Advanced Config` section. Here, you can provide the CA certificate used for SSL validation by specifying the `caCertificate`.  Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl_key`, `ssl_cert`, and `ssl_ca`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `ssl_ca` for the CA certificate to validate the server’s certificate.

{% image
  src="/images/v1.6/connectors/ssl_connection.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.6/connectors/troubleshooting.md" /%}

{% partial file="/v1.6/connectors/database/related.md" /%}
