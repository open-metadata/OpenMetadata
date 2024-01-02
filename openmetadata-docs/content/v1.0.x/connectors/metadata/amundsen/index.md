---
title: Amundsen
slug: /connectors/metadata/amundsen
---

# Amundsen

| Feature                     | Status                       |
| :----------------------     | :--------------------------- |
| Table Metadata              | {% icon iconName="check" /%} |
| Table Owner                 | {% icon iconName="check" /%} |
| Classifications/Tags        | {% icon iconName="check" /%} |
| Dashboard & Chart Metadata  | {% icon iconName="check" /%} |

If you don't want to use the OpenMetadata Ingestion container to configure the workflows via the UI, then you can check
the following docs to connect using Airflow SDK or with the CLI.

{% tilesContainer %}

{% tile
    title="Ingest with Airflow"
    description="Configure the ingestion using Airflow SDK"
    link="/connectors/metadata/amundsen/airflow"
  / %}
{% tile
    title="Ingest with the CLI"
    description="Run a one-time ingestion using the metadata CLI"
    link="/connectors/metadata/amundsen/cli"
  / %}

{% /tilesContainer %}

In this page, you will learn how to use the `metadata` CLI to run a one-ingestion.

Make sure you are running openmetadata-ingestion version 0.11.0 or above.

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
src="/images/v1.0/connectors/metadata-service-page.png"
alt="Visit Services Page"
caption="Find Metadata option on left panel of the settings page" /%}


{% /stepVisualInfo %}

{% /step %}

{% step srNumber=2 %}

{% stepDescription title="2. Create a New Service" %}

Click on the 'Add New Service' button to start the Service creation.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
src="/images/v1.0/connectors/add-service-metadata.png"
alt="Create a new service"
caption="Add a new Service from the Metadata Services page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=3 %}

{% stepDescription title="3. Select the Service Type" %}

Select the service type which are available on the page.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/amundsen/create-service-6.png"
  alt="db-service"
  caption="Select your service from the list" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=4 %}

{% stepDescription title="4. Name and Describe your Service" %}

Provide a name and description for your service as illustrated below.

OpenMetadata uniquely identifies services by their Service Name. Provide
a name that distinguishes your deployment from other services, including
the other {connector} services that you might be ingesting metadata
from.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/amundsen/create-service-7.png"
  alt="Add New Service"
  caption="Provide a Name and description for your Service" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=5 %}

{% stepDescription title="5. Configure the Service Connection" %}

In this step, we will configure the connection settings required for
this connector. Please follow the instructions below to ensure that
you've configured the connector to read from your athena service as
desired.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v1.0/connectors/amundsen/create-service-8.png"
  alt="Configure service connection"
  caption="Configure the service connection by filling the form" /%}

{% /stepVisualInfo %}

{% /step %}

{% /stepsContainer %}

{% extraContent parentTagName="stepsContainer" %}

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/amundsenConnection.json)
you can find the structure to create a connection to Amundsen. 

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a
YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/metadata/amundsenConnection.json).

### 1. Define the YAML Config

This is a sample config for Amundsen:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=5 %}

**username**: Enter the username of your Amundsen user in the Username field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow. 

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**password**: Enter the password for your amundsen user in the Password field. 

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**hostPort**: Host and port of the Amundsen Neo4j Connection. This expect a URI format like: bolt://localhost:7687.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**maxConnectionLifeTime (optional)**: Maximum connection lifetime for the Amundsen Neo4j Connection 

{% /codeInfo %}

{% codeInfo srNumber=9 %}

**validateSSL (optional)**: Enable SSL validation for the Amundsen Neo4j Connection. 

{% /codeInfo %}

{% codeInfo srNumber=10 %}

**encrypted (Optional)**: Enable encryption for the Amundsen Neo4j Connection. 

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=11 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=12 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: amundsen
  serviceName: local_amundsen
  serviceConnection:
    config:
      type: Amundsen
```
```yaml {% srNumber=5 %}
      username: <username>
```
```yaml {% srNumber=6 %}
      password: <password>
```
```yaml {% srNumber=7 %}
      hostPort: bolt://localhost:7687
```
```yaml {% srNumber=8 %}
      maxConnectionLifeTime: <time in secs.>
```
```yaml {% srNumber=9 %}
      validateSSL: <true or false>
```
```yaml {% srNumber=10 %}
      encrypted: <true or false>
  sourceConfig:
    config:
      type: DatabaseMetadata
```
```yaml {% srNumber=11 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=12 %}
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
