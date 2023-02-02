---
title: Atlas
slug: /connectors/metadata/atlas
---

# Atlas

<!-- In this page, you will learn how to use the `metadata` CLI to run a one-ingestion. -->

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to connect using Airflow SDK or with the CLI.

<TileContainer>
  <Tile
    icon="air"
    title="Ingest with Airflow"
    text="Configure the ingestion using Airflow SDK"
    link="/connectors/metadata/atlas/airflow"
    size="half"
  />
  <Tile
    icon="account_tree"
    title="Ingest with the CLI"
    text="Run a one-time ingestion using the metadata CLI"
    link="/connectors/metadata/atlas/cli"
    size="half"
  />
</TileContainer>

<Requirements />

<PythonMod connector="Atlas" module="atlas" />

<InlineCallout color="violet-70" icon="description" bold="OpenMetadata 0.13.1 or later" href="/deployment">
To deploy OpenMetadata, check the <a href="/deployment">Deployment</a> guides.
</InlineCallout>

## Create Database Service

You need to create database services before ingesting the metadata from Atlas. In OpenMetadata we have to create database services with the same name as the source.

To create database service follow these steps:

### 1.Visit Service Page

The first step is ingesting the metadata from your sources. Under Settings, you will find a Services link an external
source system to OpenMetadata. Once a service is created, it can be used to configure metadata, usage, and profiler
workflows.To visit the Services page, select Services from the Settings menu.serv

<Image src="/images/openmetadata/connectors/amundsen/create-service-1.png" alt="db-service" caption="Navigate to Settings >> Services"/>

### 2. Create a New Service

Click on the Add New Service button to start the Service creation.

<Image
src="/images/openmetadata/connectors/create-service.png"
alt="Create a new service"
caption="Add a new Service from the Services page"
/>

### 3. Complete the ingestion

For ingestion, please click [here](/connectors)

### 4. Pass the Service

<Image
src="/images/openmetadata/connectors/atlas/ui-service-name.png"
alt="service name"
caption="service name"
/>

Pass the `service name` in your config like given below

```yaml
  hostPort: http://localhost:10000
  username: username
  password: password
  databaseServiceName: ["local_hive"] # pass database service here
  messagingServiceName: [] # pass messaging service here
  entity_type: Table # this entity must be present on atlas
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/atlasConnection.json)
you can find the structure to create a connection to Atlas.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a
YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/atlasConnection.json).

<Note>

- Every table ingested will have a tag name `AtlasMetadata.atlas_table`, that can be found under `explore` section on top left corner

</Note>

### 1. Visit the Services Page

The first step is ingesting the metadata from your sources. Under Settings, you will find a Services link an external
source system to OpenMetadata. Once a service is created, it can be used to configure metadata, usage, and profiler
workflows.To visit the Services page, select Services from the Settings menu.serv

<Image src="/images/openmetadata/connectors/amundsen/create-service-1.png" alt="db-service" caption="Navigate to Settings >> Services"/>

### 2. Create a New Service

Click on the Add New Service button to start the Service creation.

<Image
src="/images/openmetadata/connectors/atlas/add-service.png"
alt="Create a new service"
caption="Add a new Service from the Services page"
/>

### 3. Select the Service Type

Select Atlas as the service type and click Next.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/atlas/atlas-service.png"
  alt="Select Service"
  caption="Select your service from the list"
/>
</div>

### 4. Name and Describe your Service

Provide a name and description for your service as illustrated below.

#### Service Name

OpenMetadata uniquely identifies services by their Service Name. Provide
a name that distinguishes your deployment from other services, including
the other {connector} services that you might be ingesting metadata
from.


<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/atlas/service-name.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service"
/>
</div>

### 5. Configure the Service Connection

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your atlas service as
desired.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/atlas/connection-options.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form"
/>
</div>

Once the credentials have been added, click on `Test Connection` and Save
the changes.

<div className="w-100 flex justify-center">
<Image
  src="/images/openmetadata/connectors/test-connection.png"
  alt="Test Connection"
  caption="Test the connection and save the Service"
/>
</div>

#### Connection Options

- **Host and Port**: Host and port of the Atlas service.
- **Username**: username to connect  to the Atlas. This user should have privileges to read all the metadata in Atlas.
- **Password**: password to connect  to the Atlas.
- **databaseServiceName**: source database of the data source(Database service that you created from UI. example- local_hive)
- **messagingServiceName**: messaging service source of the data source.
- **Entity_Type**: Name of the entity type in Atlas.

### 6. Schedule the Ingestion and Deploy

Scheduling can be set up at an hourly, daily, or weekly cadence. The
timezone is in UTC. Select a Start Date to schedule for ingestion. It is
optional to add an End Date.

Review your configuration settings. If they match what you intended,
click Deploy to create the service and schedule metadata ingestion.

If something doesn't look right, click the Back button to return to the
appropriate step and change the settings as needed.

<Image
src="/images/openmetadata/connectors/schedule.png"
alt="Schedule the Workflow"
caption="Schedule the Ingestion Pipeline and Deploy"
/>

After configuring the workflow, you can click on Deploy to create the
pipeline.

### 7. View the Ingestion Pipeline

Once the workflow has been successfully deployed, you can view the
Ingestion Pipeline running from the Service Page.

<Image
src="/images/openmetadata/connectors/atlas/ingestion-pipeline.png"
alt="View Ingestion Pipeline"
caption="View the Ingestion Pipeline from the Service Page"
/>

### 8. Workflow Deployment Error

If there were any errors during the workflow deployment process, the
Ingestion Pipeline Entity will still be created, but no workflow will be
present in the Ingestion container.

You can then edit the Ingestion Pipeline and Deploy it again.

<Image
src="/images/openmetadata/connectors/atlas/workflow-deployment-error.png"
alt="Workflow Deployment Error"
caption="Edit and Deploy the Ingestion Pipeline"
/>

From the Connection tab, you can also Edit the Service if needed.

### 1. Define the YAML Config

This is a sample config for Atlas:

```yaml
source:
  type: Atlas
  serviceName: local_atlas
  serviceConnection:
    config:
      type: Atlas
      hostPort: http://localhost:10000
      username: username
      password: password
      databaseServiceName: ["local_hive"] # create database service and messaging service and pass `service name` here
      messagingServiceName: []
      entity_type: Table
  sourceConfig:
    config:
      type: DatabaseMetadata
sink: 
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "<OpenMetadata host and port>"
    authProvider: "<OpenMetadata auth provider>"
```

### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/atlasConnection.json).

- `username`: Username to connect to the Atlas. This user should have privileges to read all the metadata in Atlas.
- `password`: Password to connect to the Atlas.
- `hostPort`: Atlas Host of the data source.
- `databaseServiceName`: source database of the data source(Database service that you created from UI. example- local_hive).
- `messagingServiceName`: messaging service source of the data source.
- `entity_type`: Name of the entity type in Atlas.

### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your
OpenMetadata installation. For a simple, local installation using our docker containers, this looks like:

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

<Collapse title="Configure SSO in the Ingestion Workflows">

### Openmetadata JWT Auth

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

### Auth0 SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: auth0
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```

### Azure SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: azure
    securityConfig:
      clientSecret: "{your_client_secret}"
      authority: "{your_authority_url}"
      clientId: "{your_client_id}"
      scopes:
        - your_scopes
```

### Custom OIDC SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: custom-oidc
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```

### Google SSO

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: google
    securityConfig:
      secretKey: "{path-to-json-creds}"
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
    hostPort: "http://localhost:8585/api"
    authProvider: auth0
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```

### OneLogin SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: custom-oidc
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```

### KeyCloak SSO

Which uses Custom OIDC for the ingestion

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: custom-oidc
    securityConfig:
      clientId: "{your_client_id}"
      secretKey: "{your_client_secret}"
      domain: "{your_domain}"
```

</Collapse>

## 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```yaml
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration, you will
be able to extract metadata from different sources.
