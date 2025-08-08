---
title: Tableau Connector | `brandName` Integration Guide
description: Connect Tableau dashboards to `brandName` with our comprehensive connector guide. Setup instructions, configuration options, and metadata extraction steps.
slug: /connectors/dashboard/tableau
---

{% connectorDetailsHeader
name="Tableau"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Dashboards", "Charts", "Lineage", "Owners", "Datamodels", "Tags", "Projects", "Column Lineage", "Usage"]
unavailableFeatures=[]
/ %}


In this section, we provide guides and references to use the Tableau connector.

Configure and schedule Tableau metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Enable Security](#securing-tableau-connection-with-ssl-in-openmetadata)
- [Lineage](#lineage)
- [Troubleshooting](/connectors/dashboard/tableau/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/dashboard/tableau/yaml"} /%}

## Requirements

To ingest tableau metadata, minimum `Site Role: Viewer` is required for the tableau user.

To create lineage between tableau dashboard and any database service via the queries provided from Tableau Metadata API, please enable the Tableau Metadata API for your tableau server.
For more information on enabling the Tableau Metadata APIs follow the link [here](https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html)

{% note %}
- If using a **default site** on Tableau Server, leave the **Site URL** and **Site Name** fields **blank** in the ingestion configuration.  
- Ensure that the **Metadata API** is enabled for the user performing the ingestion. If it is not enabled, ingestion may fail. Follow the official Tableau documentation to [enable the Metadata API](https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html#enable-the-tableau-metadata-api-for-tableau-server).
- The minimum required role to retrieve owners is Site Admin Explorer.
{% /note %}

{% note %}
- As of OpenMetadata versions `1.7.4` and `1.7.5`, the `siteUrl` field has been removed from the Tableau connector configuration. This change was intentional, as confirmed in the release commit.  
- To connect to a non-default Tableau site, use the `siteName` field instead. The Tableau Python SDK does not require `siteUrl` for authentication.  
- Ensure the `siteName` field is correctly populated (do not use `*`) to enable successful metadata ingestion for multi-site Tableau environments.
{% /note %}

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Tableau", 
    selectServicePath: "/images/v1.7/connectors/tableau/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/tableau/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/tableau/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Host and Port**: URL or IP address of your installation of Tableau Server.
- **Authentication Types**:
    1. Basic Authentication
    - Username: The name of the user whose credentials will be used to sign in.
    - Password: The password of the user.
    2. Access Token Authentication
    - Personal Access Token: The personal access token name. For more information to get a Personal Access Token please visit this [link](https://help.tableau.com/current/server/en-us/security_personal_access_tokens.htm).
    - Personal Access Token Secret: The personal access token value. For more information to get a Personal Access Token please visit this [link](https://help.tableau.com/current/server/en-us/security_personal_access_tokens.htm).
- **API Version**: Tableau API version. A lists versions of Tableau Server and of the corresponding REST API and REST API schema versions can be found [here](https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_versions.htm).
- **Site Name**: This corresponds to the `contentUrl` attribute in the Tableau REST API. The `site_name` is the portion of the URL that follows the `/site/` in the URL.
- **Site URL**: If it is empty, the default Tableau site name will be used.
- **Environment**: The config object can have multiple environments. The default environment is defined as `tableau_prod`, and you can change this if needed by specifying an `env` parameter.
- **Pagination Limit**: The pagination limit will be used while querying the Tableau Graphql endpoint to get the data source information.

### Site Name and Site URL

#### 1. Service Connection for Tableau Cloud

If you're connecting to a cloud Tableau instance, add the `Site Name` and `Site URL` with your site name.

#### 2. Service Connection for a default tableau site

For a default tableau site `Site Name` and `Site URL` fields should be kept empty.

#### 3. Service Connection for a non-default tableau site

For a non-default tableau site `Site Name` and `Site URL` fields are required.

{% note %}
If `https://xxx.tableau.com/#/site/MarketingTeam/home` represents the homepage url for your tableau site, the `MarketingTeam` from the url should be entered in the `Site Name` and `Site Url` fields.
{% /note %}

### Authentication Type

### 1. Basic Authentication

We need the name of the user whose credentials will be used to sign in and the password of the user.

### 2. Access Token Authentication

In this case, the personal access token name and the personal access token value are required.

For more information to get a Personal Access Token please visit this [link](https://help.tableau.com/current/server/en-us/security_personal_access_tokens.htm).


{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/dashboard/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing Tableau Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and Tableau, navigate to the `Advanced Config` section. Here, you can provide the CA certificate used for SSL validation by specifying the `caCertificate`. Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl key`, `ssl cert`, and `caCertificate`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `caCertificate` for the CA certificate to validate the server’s certificate.

  {% image
  src="/images/v1.7/connectors/ssl_tableau.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% partial file="/v1.7/connectors/dashboard/dashboard-lineage.md" /%}
