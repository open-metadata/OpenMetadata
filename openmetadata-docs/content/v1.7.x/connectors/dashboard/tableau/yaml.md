---
title: Run the Tableau Connector Externally
description: Configure Tableau dashboard connections in OpenMetadata using YAML. Step-by-step guide for seamless data catalog integration and metadata extraction.
slug: /connectors/dashboard/tableau/yaml
---

{% connectorDetailsHeader
name="Tableau"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Dashboards", "Charts", "Lineage", "Owners", "Datamodels", "Tags", "Projects", "Usage"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Tableau connector.

Configure and schedule Tableau metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Enable Security](#securing-tableau-connection-with-ssl-in-openmetadata)

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

To ingest tableau metadata, minimum `Site Role: Viewer` is required for the tableau user.

To create lineage between tableau dashboard and any database service via the queries provided from Tableau Metadata API, please enable the Tableau Metadata API for your tableau server.
For more information on enabling the Tableau Metadata APIs follow the link [here](https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html)

{% note %}
- If using a **default site** on Tableau Server, leave the **Site Name** field **blank** in the ingestion configuration.  
- Ensure that the **Metadata API** is enabled for the user performing the ingestion. If it is not enabled, ingestion may fail. Follow the official Tableau documentation to [enable the Metadata API](https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html#enable-the-tableau-metadata-api-for-tableau-server).  
{% /note %}

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Tableau ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[tableau]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/dashboard/tableauConnection.json)
you can find the structure to create a connection to Tableau.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Tableau:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**For Basic Authentication:**

**Username**: The name of the user whose credentials will be used to sign in.

**Password**: The password of the user.

{% /codeInfo %}

{% codeInfo srNumber=2%}

**For Access Token Authentication:**

**Personal Access Token**: The personal access token name. For more information to get a Personal Access Token please visit this [link](https://help.tableau.com/current/server/en-us/security_personal_access_tokens.htm).

**Personal Access Token Secret**: The personal access token value. For more information to get a Personal Access Token please visit this [link](https://help.tableau.com/current/server/en-us/security_personal_access_tokens.htm).

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**hostPort**: URL or IP address of your installation of Tableau Server.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**siteName**: Tableau Site Name. This corresponds to the `contentUrl` attribute in the Tableau REST API. The `site_name` is the portion of the URL that follows the `/site/` in the URL.

{% /codeInfo %}

{% codeInfo srNumber=11 %}

**paginationLimit**: The pagination limit will be used while querying the Tableau Graphql endpoint to get the data source information.

{% /codeInfo %}

{% codeInfo srNumber=12 %}
**verifySSL**: Client SSL verification. Make sure to configure the SSLConfig if enabled. Supported values `no-ssl`, `ignore`, `validate`.
{% /codeInfo %}

{% codeInfo srNumber=13 %}
**sslMode**: Mode of SSL. Default is `disabled`. Supported modes are `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`.
{% /codeInfo %}

{% codeInfo srNumber=14 %}
**sslConfig**: Client SSL configuration.
{% /codeInfo %}


#### Source Configuration - Source Config

{% codeInfo srNumber=8 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/dashboardServiceMetadataPipeline.json):

- **dbServiceNames**: Database Service Names for ingesting lineage if the source supports it.
- **dashboardFilterPattern**, **chartFilterPattern**, **dataModelFilterPattern**: Note that all of them support regex as include or exclude. E.g., "My dashboard, My dash.*, .*Dashboard".
- **projectFilterPattern**: Filter the tableau dashboards, charts and data sources by projects. Note that all of them support regex as include or exclude. E.g., "My project, My proj.*, .*Project".
- **includeOwners**: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.
- **includeTags**: Set the 'Include Tags' toggle to control whether to include tags in metadata ingestion.
- **includeDataModels**: Set the 'Include Data Models' toggle to control whether to include tags as part of metadata ingestion.
- **markDeletedDashboards**: Set the 'Mark Deleted Dashboards' toggle to flag dashboards as soft-deleted if they are not present anymore in the source system.


{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=9 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}


{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: tableau
  serviceName: local_tableau
  serviceConnection:
    config:
      type: Tableau
```
```yaml {% srNumber=1 %}
      # authType:
      #   username: username
      #   password: password
```
```yaml {% srNumber=2 %}
      # authType:
      #   personalAccessTokenName: personal_access_token_name
      #   personalAccessTokenSecret: personal_access_token_secret
```
```yaml {% srNumber=4 %}
      hostPort: http://localhost
```
```yaml {% srNumber=5 %}
      siteName: site_name
```
```yaml {% srNumber=11 %}
      paginationLimit: pagination_limit
```
```yaml {% srNumber=12 %}
      # verifySSL: no-ssl
```
```yaml {% srNumber=13 %}
      # sslMode: disable
```
```yaml {% srNumber=14 %}
      # sslConfig:
      #   caCertificate: |
      #     -----BEGIN CERTIFICATE-----
      #     sample certificate
      #     -----END CERTIFICATE-----
      #   sslCertificate: |
      #     -----BEGIN CERTIFICATE-----
      #     sample certificate
      #     -----END CERTIFICATE-----
      #   sslKey: |
      #     -----BEGIN PRIVATE KEY-----
      #     sample certificate
      #     -----END PRIVATE KEY-----
```


{% partial file="/v1.7/connectors/yaml/dashboard/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

### Example Source Configurations for default and non-default tableau sites

#### 1. Sample config for default tableau site

For a default tableau site `siteName` and `siteUrl` fields should be kept as empty strings as shown in the below config.

```yaml
source:
  type: tableau
  serviceName: local_tableau
  serviceConnection:
    config:
      type: Tableau
      # For Tableau, choose one of basic or access token authentication
      # # For basic authentication
      # authType:
      #   username: username
      #   password: password
      # # For access token authentication
      # authType:
      #   personalAccessTokenName: personal_access_token_name
      #   personalAccessTokenSecret: personal_access_token_secret
      hostPort: http://localhost
      siteName: site_name
  sourceConfig:
    config:
      type: DashboardMetadata
      includeOwners: True
      markDeletedDashboards: True
      includeTags: True
      includeDataModels: True
      # lineageInformation:
      #   dbServiceNames:
      #     - service1
      #     - service2
      # dashboardFilterPattern:
      #   includes:
      #     - dashboard1
      #     - dashboard2
      #   excludes:
      #     - dashboard3
      #     - dashboard4
      # chartFilterPattern:
      #   includes:
      #     - chart1
      #     - chart2
      #   excludes:
      #     - chart3
      #     - chart4
      # dataModelFilterPattern:
      #   includes:
      #     - datamodel1
      #     - datamodel2
      #   excludes:
      #     - datamodel3
      #     - datamodel4
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

#### 1. Sample config for non-default tableau site

For a non-default tableau site `siteName` and `siteUrl` fields are required.

**Note**: If `https://xxx.tableau.com/#/site/sitename/home` represents the homepage url for your tableau site, the `sitename` from the url should be entered in the `siteName` and `siteUrl` fields in the config below.

```yaml
source:
  type: tableau
  serviceName: local_tableau
  serviceConnection:
    config:
      type: Tableau
      username: username
      password: password
      env: tableau_prod
      hostPort: http://localhost
      siteName: openmetadata
      siteUrl: openmetadata
      apiVersion: api_version
      # If not setting user and password
      # personalAccessTokenName: personal_access_token_name
      # personalAccessTokenSecret: personal_access_token_secret
  sourceConfig:
    config:
      type: DashboardMetadata
      # dbServiceNames:
      #   - service1
      #   - service2
      # dashboardFilterPattern:
      #   includes:
      #     - dashboard1
      #     - dashboard2
      #   excludes:
      #     - dashboard3
      #     - dashboard4
      # chartFilterPattern:
      #   includes:
      #     - chart1
      #     - chart2
      #   excludes:
      #     - chart3
      #     - chart4
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  # loggerLevel: DEBUG  # DEBUG, INFO, WARN or ERROR
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```
## Securing Tableau Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and Tableau, in the `YAML` you can provide the CA certificate used for SSL validation by specifying the `caCertificate`. Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl key`, `ssl cert`, and `caCertificate`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `caCertificate` for the CA certificate to validate the server’s certificate.

```yaml
      sslConfig:
            caCertificate: "/path/to/ca_certificate"
            sslCertificate: "/path/to/your/ssl_cert"
            sslKey: "/path/to/your/ssl_key"
```

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}
