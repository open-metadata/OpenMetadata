---
title: Atlas
slug: /connectors/metadata/atlas
---

# Atlas

| Feature                     | Status                       |
| :-----------                | :--------------------------- |
| Lineage                     | {% icon iconName="check" /%} |
| Classifications/Tags        | {% icon iconName="check" /%} |
| Database, Schema & Table  Descriptions  | {% icon iconName="check" /%} |
| Topic Descriptions          | {% icon iconName="check" /%} |

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to connect using Airflow SDK or with the CLI.

{% tilesContainer %}

{% tile
    title="Ingest with Airflow"
    description="Configure the ingestion using Airflow SDK"
    link="/connectors/metadata/atlas/airflow"
  / %}
{% tile
    title="Ingest with the CLI"
    description="Run a one-time ingestion using the metadata CLI"
    link="/connectors/metadata/atlas/cli"
  / %}

{% /tilesContainer %}

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

## Create Database Service

You need to create database services before ingesting the metadata from Atlas. In OpenMetadata we have to create database services.

To create database service follow these steps:

{% stepsContainer %}

{% step srNumber=1 %}

{% stepDescription title="1. Visit the Services Page" %}

The first step is ingesting the metadata from your sources. Under
Settings, you will find a Services link an external source system to
OpenMetadata. Once a service is created, it can be used to configure
metadata, usage, and profiler workflows.

To visit the Services page, select Services from the Settings menu.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/visit-database-service-page.png"
alt="Visit Services Page"
caption="Find Databases option on left panel of the settings page" /%}

{% /stepVisualInfo %}

{% /step %}


{% step srNumber=2 %}

{% stepDescription title="2. Create a New Service" %}

Click on the 'Add New Service' button to start the Service creation.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/create-database-service.png"
alt="Create a new service"
caption="Add a new Service from the Database Services page" /%}

{% /stepVisualInfo %}

{% /step %}


{% step srNumber=3 %}

{% stepDescription title="3. Complete the ingestion" %}

For ingestion, please click [here](/connectors)

{% /stepDescription %}
{% /step %}

{% step srNumber=4 %}

{% stepDescription title="4. Pass the Service" %}

Pass the `service name` in your config like given below

```yaml
  hostPort: http://localhost:10000
  username: username
  password: password
  databaseServiceName: ["local_hive"] # pass database service here
  messagingServiceName: [] # pass messaging service here
  entity_type: Table # this entity must be present on atlas
```

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/atlas/ui-service-name.png"
alt="service name"
caption="service name" /%}

{% /stepVisualInfo %}

{% /step %}


{% /stepsContainer %}




## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/atlasConnection.json)
you can find the structure to create a connection to Atlas.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a
YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/atlasConnection.json).

**Note:** Every table ingested will have a tag name `AtlasMetadata.atlas_table`, that can be found under `explore` section on top left corner

{% stepsContainer %}

{% step srNumber=5 %}

{% stepDescription title="1. Visit the Services Page" %}

The first step is ingesting the metadata from your sources. Under
Settings, you will find a Services link an external source system to
OpenMetadata. Once a service is created, it can be used to configure
metadata, usage, and profiler workflows.

To visit the Services page, select Services from the Settings menu.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/metadata-service-page.png"
alt="Visit Services Page"
caption="Find Metadata option on left panel of the settings page" /%}

{% /stepVisualInfo %}

{% /step %}



{% step srNumber=6 %}

{% stepDescription title="2. Create a New Service" %}

Click on the 'Add New Service' button to start the Service creation.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/atlas/add-service.png"
alt="Create a new service"
caption="Add a new Service from the Services page" /%}

{% /stepVisualInfo %}

{% /step %}


{% step srNumber=7 %}

{% stepDescription title="3. Select the Service Type" %}

Select Atlas as the service type and click Next.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/atlas/atlas-service.png"
  alt="Select Service"
  caption="Select your service from the list" /%}

{% /stepVisualInfo %}

{% /step %}


{% step srNumber=8 %}

{% stepDescription title="4. Name and Describe your Service" %}

Provide a name and description for your service as illustrated below.

#### Service Name

OpenMetadata uniquely identifies services by their Service Name. Provide
a name that distinguishes your deployment from other services, including
the other {connector} services that you might be ingesting metadata
from.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/atlas/service-name.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your azuresql service as
desired.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/atlas/connection-options.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}

{% extraContent parentTagName="stepsContainer" %}

#### Connection Options

- **Host and Port**: Host and port of the Atlas service.
- **Username**: username to connect  to the Atlas. This user should have privileges to read all the metadata in Atlas.
- **Password**: password to connect  to the Atlas.
- **databaseServiceName**: source database of the data source(Database service that you created from UI. example- local_hive)
- **messagingServiceName**: messaging service source of the data source.
- **Entity_Type**: Name of the entity type in Atlas.

{% /extraContent %}

{% step srNumber=9 %}

{% stepDescription title="6. Test the Connection" %}

Once the credentials have been added, click on `Test Connection` and Save
the changes.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/test-connection.png"
  alt="Test Connection"
  caption="Test the connection and save the Service" /%}

{% /stepVisualInfo %}

{% /step %}


{% step srNumber=10 %}

{% stepDescription title="8. Schedule the Ingestion and Deploy" %}

Scheduling can be set up at an hourly, daily, weekly, or manual cadence. The
timezone is in UTC. Select a Start Date to schedule for ingestion. It is
optional to add an End Date.

Review your configuration settings. If they match what you intended,
click Deploy to create the service and schedule metadata ingestion.

If something doesn't look right, click the Back button to return to the
appropriate step and change the settings as needed.

After configuring the workflow, you can click on Deploy to create the
pipeline.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/schedule.png"
alt="Schedule the Workflow"
caption="Schedule the Ingestion Pipeline and Deploy" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=11 %}

{% stepDescription title="9. View the Ingestion Pipeline" %}

Once the workflow has been successfully deployed, you can view the
Ingestion Pipeline running from the Service Page.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/view-ingestion-pipeline.png"
alt="View Ingestion Pipeline"
caption="View the Ingestion Pipeline from the Service Page" /%}

{% /stepVisualInfo %}

{% /step %}



{% /stepsContainer %}

## Troubleshooting

 ### Workflow Deployment Error

If there were any errors during the workflow deployment process, the
Ingestion Pipeline Entity will still be created, but no workflow will be
present in the Ingestion container.

- You can then edit the Ingestion Pipeline and Deploy it again.

- From the Connection tab, you can also Edit the Service if needed.

{% image
src="/images/v1.0/connectors/workflow-deployment-error.png"
alt="Workflow Deployment Error"
caption="Edit and Deploy the Ingestion Pipeline" /%}



### 1. Define the YAML Config

This is a sample config for Atlas:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=12 %}

**hostPort**: Atlas Host of the data source.

{% /codeInfo %}

{% codeInfo srNumber=13 %}

**username**: Username to connect to the Atlas. This user should have privileges to read all the metadata in Atlas.

{% /codeInfo %}

{% codeInfo srNumber=14 %}

**password**: Password to connect to the Atlas.

{% /codeInfo %}

{% codeInfo srNumber=15 %}

**databaseServiceName**: source database of the data source(Database service that you created from UI. example- local_hive).

{% /codeInfo %}

{% codeInfo srNumber=16 %}

**messagingServiceName**: messaging service source of the data source.

{% /codeInfo %}

{% codeInfo srNumber=17 %}

**entity_type**: Name of the entity type in Atlas.

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=18 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=19 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}
{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: Atlas
  serviceName: local_atlas
  serviceConnection:
    config:
      type: Atlas
```
```yaml {% srNumber=12 %}
      hostPort: http://localhost:10000
```
```yaml {% srNumber=13 %}
      username: username
```
```yaml {% srNumber=14 %}
      password: password
```
```yaml {% srNumber=15 %}
      databaseServiceName: ["local_hive"] # create database service and messaging service and pass `service name` here
```
```yaml {% srNumber=16 %}
      messagingServiceName: []
```
```yaml {% srNumber=17 %}
      entity_type: Table
  sourceConfig:
    config:
      type: DatabaseMetadata
```
```yaml {% srNumber=18 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=19 %}
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

{% /codeBlock %}

{% /codePreview %}


### Workflow Configs for Security Provider

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/openmetadata-spec/src/main/resources/json/schema/security/client).

## Openmetadata JWT Auth

- JWT tokens will allow your clients to authenticate against the OpenMetadata server. To enable JWT Tokens, you will get more details [here](/deployment/security/enable-jwt-tokens).

```yaml
workflowConfig:
  openMetadataServerConfig:
    hostPort: "http://localhost:8585/api"
    authProvider: openmetadata
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

- You can refer to the JWT Troubleshooting section [link](/deployment/security/jwt-troubleshooting) for any issues in your JWT configuration. If you need information on configuring the ingestion with other security providers in your bots, you can follow this doc [link](/deployment/security/workflow-config-auth).

## 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```yaml
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration, you will
be able to extract metadata from different sources.


