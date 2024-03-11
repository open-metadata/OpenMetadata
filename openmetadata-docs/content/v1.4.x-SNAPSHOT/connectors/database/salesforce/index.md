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

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/salesforce/yaml"} /%}

## Requirements

These are the permissions you will require to fetch the metadata from Salesforce.

- **API Access**: You must have the API Enabled permission in your Salesforce organization.
- **Object Permissions**: You must have read access to the Salesforce objects that you want to ingest.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Salesforce", 
    selectServicePath: "/images/v1.3/connectors/salesforce/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/salesforce/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/salesforce/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Username to connect to the Salesforce. This user should have the access as defined in requirements.
- **Password**: Password to connect to Salesforce.
- **Security Token**: Salesforce Security Token is required to access the metadata through APIs. You can checkout [this doc](https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm&type=5) on how to get the security token.
- **Salesforce Object Name**: Specify the Salesforce Object Name in case you want to ingest a specific object.  If left blank, we will ingest all the Objects.
- **Salesforce API Version**: Follow the steps mentioned [here](https://help.salesforce.com/s/articleView?id=000386929&type=1) to get the API version. Enter the numerical value in the field, For example `42.0`.
- **Salesforce Domain**: When connecting to Salesforce, you can specify the domain to use for accessing the platform. The common domains include `login` and `test`, and you can also utilize Salesforce My Domain.
By default, the domain `login` is used for accessing Salesforce.

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
