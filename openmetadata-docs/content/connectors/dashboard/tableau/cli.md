---
title: Run Tableau Connector using the CLI
slug: /connectors/dashboard/tableau/cli
---

# Run Tableau using the metadata CLI

In this section, we provide guides and references to use the Tableau connector.

Configure and schedule Tableau metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

## Requirements

To ingest tableau metadata, minimum `Site Role: Viewer` is requried for the tableau user.

<InlineCallout color="violet-70" icon="description" bold="OpenMetadata 0.12 or later" href="/deployment">
To deploy OpenMetadata, check the <a href="/deployment">Deployment</a> guides.
</InlineCallout>

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

To create lineage between tableau dashboard and any database service via the queries provided from Tableau Metadata API, please enable the Tableau Metadata API for your tableau server.
For more information on enabling the Tableau Metadata APIs follow the link [here](https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html)

### Python Requirements

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
      env: tableau_prod
      hostPort: http://localhost
      siteName: site_name
      siteUrl: site_url
      apiVersion: api_version
  sourceConfig:
    config:
      type: DashboardMetadata
      overrideOwner: True
      markDeletedDashboards: True
      includeTags: True
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
      env: tableau_prod
      hostPort: http://localhost
      siteName: ""
      siteUrl: ""
      apiVersion: api_version
  sourceConfig:
    config:
      overrideOwner: True
      markDeletedDashboards: True
      includeTags: True
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

#### 1. Sample config for non-default tableau site

For a non-default tableau site `siteName` and `siteUrl` fields are required.

<Note>

If `https://xxx.tableau.com/#/site/sitename/home` represents the homepage url for your tableau site, the `sitename` from the url should be entered in the `siteName` and `siteUrl` fields in the config below.

</Note>

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
      env: tableau_prod
      hostPort: http://localhost
      siteName: openmetadata
      siteUrl: openmetadata
      apiVersion: api_version
  sourceConfig:
    config:
      type: DashboardMetadata
      overrideOwner: True
      markDeletedDashboards: True
      includeTags: True
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

#### Source Configuration - Service Connection

- **Host and Port**: URL to the Tableau instance.
- **Authentication Types**:
  1. Basic Authenticaton
    - Username: Specify the User to connect to Tableau. It should have enough privileges to read all the metadata.
    - Password: Password for Tableau.
  2. Access Token Authentication
    - Personal Access Token: Access token. To be used if not logging in with user/password.
    - Personal Access Token Secret: Access token Secret. To be used if not logging in with user/password.
- **API Version**: Tableau API version. 
- **Site Name**: Tableau Site Name. To be kept empty if you are using the default Tableau site
- **Site Url**: Tableau Site Url. To be kept empty if you are using the default Tableau site
- **Environment**: Tableau Environment.

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/dashboardServiceMetadataPipeline.json):

- `dbServiceNames`: Database Service Name for the creation of lineage, if the source supports it.
- `dashboardFilterPattern` and `chartFilterPattern`: Note that the `dashboardFilterPattern` and `chartFilterPattern` both support regex as include or exclude. E.g.,
- `overrideOwner`: Flag to override current owner by new owner from source, if found during metadata ingestion
- `includeTags`: Set the Include tags toggle to control whether or not to include tags as part of metadata ingestion.
- `markDeletedDashboards`: Set the Mark Deleted Dashboards toggle to flag dashboards as soft-deleted if they are not present anymore in the source system.

```yaml
dashboardFilterPattern:
  includes:
    - users
    - type_test
```

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).
You can find the different implementation of the ingestion below.

<Collapse title="Configure SSO in the Ingestion Workflows">

### Openmetadata JWT Auth

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

### Auth0 SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: auth0
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### Azure SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: azure
    securityConfig:
      clientSecret: '{your_client_secret}'
      authority: '{your_authority_url}'
      clientId: '{your_client_id}'
      scopes:
        - your_scopes
```

### Custom OIDC SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### Google SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: google
    securityConfig:
      secretKey: '{path-to-json-creds}'
```

### Okta SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: okta
    securityConfig:
      clientId: "{CLIENT_ID - SPA APP}"
      orgURL: "{ISSUER_URL}/v1/token"
      privateKey: "{public/private keypair}"
      email: "{email}"
      scopes:
        - token
```

### Amazon Cognito SSO

The ingestion can be configured by [Enabling JWT Tokens](https://docs.open-metadata.org/deployment/security/enable-jwt-tokens)

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: auth0
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### OneLogin SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

### KeyCloak SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: custom-oidc
    securityConfig:
      clientId: '{your_client_id}'
      secretKey: '{your_client_secret}'
      domain: '{your_domain}'
```

</Collapse>


### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.
