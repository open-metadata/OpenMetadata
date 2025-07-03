---
title: Salesforce Connector | OpenMetadata CRM Integration Guide
description: Connect Salesforce to OpenMetadata with our database connector. Discover, catalog, and manage your Salesforce data assets seamlessly. Setup guide included.
slug: /connectors/database/salesforce
---

{% connectorDetailsHeader
name="Salesforce"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures", "Owners", "Tags", "Sample Data"]
/ %}


In this section, we provide guides and references to use the Salesforce connector.

Configure and schedule Salesforce metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Enable Security](#securing-salesforce-connection-with-ssl-in-openmetadata)
- [Troubleshooting](/connectors/database/salesforce/troubleshooting)

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/salesforce/yaml"} /%}

## Requirements

These are the permissions you will require to fetch the metadata from Salesforce.

- **API Access**: You must have the API Enabled permission in your Salesforce organization.
- **Object Permissions**: You must have read access to the Salesforce objects that you want to ingest.

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Salesforce", 
    selectServicePath: "/images/v1.9/connectors/salesforce/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/salesforce/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/salesforce/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to the Salesforce. This user should have the access as defined in requirements.
- **Password**: Password to connect to Salesforce.
- **Security Token**: Salesforce Security Token is required to access the metadata through APIs. You can checkout [this doc](https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm&type=5) on how to get the security token.
- **Organization ID**: Salesforce Organization ID is the unique identifier for your Salesforce identity. You can check out [this doc](https://help.salesforce.com/s/articleView?id=000385215&type=1) on how to get the your Salesforce Organization ID.
  {% note %}
  **Note**: You need to provide `15` digit organization id in this section. for e.g. `00DIB000004nDEq`, which you can find by following the steps mentioned in above doc (`Salesforce dashboard->Setup->Company Profile->Company Information->Salesforce.com Organization Id`).
  {% /note %}
  {% note %}
  **Note**: If you want to access salesforce metadata without token(only by using organization id), you will need to setup your ip in trusted ip ranges. You can go (`Salesforce dashboard->Setup->Security->Network Access->Trusted IP Ranges`) to configure this. You can check [here](https://help.salesforce.com/s/articleView?id=sf.security_networkaccess.htm&type=5) to configure your ip in trusted ip ranges.
  {% /note %}
- **Salesforce Object Name**: Specify the Salesforce Object Name in case you want to ingest a specific object.  If left blank, we will ingest all the Objects.
- **Salesforce API Version**: Follow the steps mentioned [here](https://help.salesforce.com/s/articleView?id=000386929&type=1) to get the API version. Enter the numerical value in the field, For example `42.0`.
- **Salesforce Domain**: When connecting to Salesforce, you can specify the domain to use for accessing the platform. The common domains include `login` and `test`, and you can also utilize Salesforce My Domain.
By default, the domain `login` is used for accessing Salesforce.

**SSL Configuration**

In order to integrate SSL in the Metadata Ingestion Config, the user will have to add the SSL config under sslConfig which is placed in the source.

{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Salesforce Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and Salesforce, navigate to the `Advanced Config` section. Here, you can provide the CA certificate used for SSL validation by specifying the `caCertificate`.  Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl_key`, `ssl_cert`, and `ssl_ca`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `ssl_ca` for the CA certificate to validate the server’s certificate.

{% image
  src="/images/v1.9/connectors/ssl_connection.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.9/connectors/troubleshooting.md" /%}

{% partial file="/v1.9/connectors/database/related.md" /%}
