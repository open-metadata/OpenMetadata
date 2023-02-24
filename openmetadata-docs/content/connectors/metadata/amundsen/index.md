---
title: Amundsen
slug: /connectors/metadata/amundsen
---

# Amundsen

In this page, you will learn how to use the `metadata` CLI to run a one-ingestion.

<Requirements />

<PythonMod connector="Amundsen" module="amundsen" />

Make sure you are running openmetadata-ingestion version 0.11.0 or above.


## Create Database Services

You need to create database services before ingesting the metadata from Amundsen. In the below example we have 5 tables
from 3 data sources i.e., `hive`, `dynamo` & `delta` so in OpenMetadata we have to create database services with the same name
as the source.

<Image src="/images/openmetadata/connectors/amundsen/create-db-service.webp" alt="db-service" caption="Amundsen dashboard"/>

To create database service follow these steps:

### 1. Visit the Services Page

The first step is ingesting the metadata from your sources. Under Settings, you will find a Services link an external
source system to OpenMetadata. Once a service is created, it can be used to configure metadata, usage, and profiler
workflows.To visit the Services page, select Services from the Settings menu.serv

<Image src="/images/openmetadata/connectors/amundsen/create-service-1.webp" alt="db-service" caption="Navigate to Settings >> Services"/>

### 2. Create a New Service

Click on the Add New Service button to start the Service creation.

<Image src="/images/openmetadata/connectors/amundsen/create-service-2.webp" alt="db-service" caption="Add a New Service from the Database Services Page"/>

### 3. Select the Service Type

Select the service type which are available on the amundsen and create a service one by one. In this example we will
need to create services for hive, dynamo db & deltalake. Possible service names are `athena`, `bigquery`, `db2`, `druid`, `delta`,
`salesforce`, `oracle`, `glue`, `snowflake` or `hive`.

<Image src="/images/openmetadata/connectors/amundsen/create-service-3.webp" alt="db-service"/>


<Image src="/images/openmetadata/connectors/amundsen/create-service-4.webp" alt="db-service"/>

Note: Adding ingestion in this step is optional, because we will fetch the metadata from Amundsen. After creating all
the database services, `my service` page looks like below, and we are ready to start with the Amundsen ingestion via the CLI.

<Image src="/images/openmetadata/connectors/amundsen/create-service-5.webp" alt="db-service"/>

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/amundsenConnection.json)
you can find the structure to create a connection to Amundsen. 

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a
YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/amundsenConnection.json).

### 1. Define the YAML Config

This is a sample config for Amundsen:

```yaml
source:
  type: amundsen
  serviceName: local_amundsen
  serviceConnection:
    config:
      type: Amundsen
      username: <username>
      password: <password>
      hostPort: bolt://localhost:7687
      maxConnectionLifeTime: <time in secs.>
      validateSSL: <true or false>
      encrypted: <true or false>
  sourceConfig:
    config:
      type: DatabaseMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/amundsenConnection.json).

- `username`: Enter the username of your Amundsen user in the Username field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow. 
- `password`: Enter the password for your amundsen user in the Password field. 
- `hostPort`: Host and port of the Amundsen Neo4j Connection. This expect a URI format like: bolt://localhost:7687.
- `maxConnectionLifeTime` (optional): Maximum connection lifetime for the Amundsen Neo4j Connection 
- `validateSSL` (optional): Enable SSL validation for the Amundsen Neo4j Connection. 
- `encrypted` (Optional): Enable encryption for the Amundsen Neo4j Connection. 

### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your
OpenMetadata installation. For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: 'http://localhost:8585/api'
    authProvider: openmetadata
    securityConfig:
      jwtToken: '{bot_jwt_token}'
```

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

## 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```yaml
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration, you will
be able to extract metadata from different sources.
