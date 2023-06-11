---
title: Amundsen
slug: /connectors/metadata/amundsen
---

# Amundsen


In this page, you will learn how to use the `metadata` CLI to run a one-ingestion.

Make sure you are running openmetadata-ingestion version 0.11.0 or above.


## Create Database Services

You need to create database services before ingesting the metadata from Amundsen. In the below example we have 5 tables
from 3 data sources i.e., `hive`, `dynamo` & `delta` so in OpenMetadata we have to create database services with the same name
as the source.

{% image
src="/images/v0.13.3/openmetadata/connectors/amundsen/create-db-service.png"
alt="db-service"
caption="Amundsen dashboard" /%}

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
src="/images/v0.13.3/openmetadata/connectors/visit-database-service-page.png"
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
src="/images/v0.13.3/openmetadata/connectors/create-database-service.png"
alt="Create a new service"
caption="Add a new Service from the Database Services page" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=3 %}

{% stepDescription title="3. Select the Service Type" %}

Select the service type which are available on the amundsen and create a service one by one. In this example we will
need to create services for hive, dynamo db & deltalake. Possible service names are `athena`, `bigquery`, `db2`, `druid`, `delta`,
`salesforce`, `oracle`, `glue`, `snowflake` or `hive`.

{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v0.13.3/openmetadata/connectors/amundsen/create-service-3.png"
  alt="db-service"
  caption="Select your service from the list" /%}

{% /stepVisualInfo %}

{% /step %}

{% step srNumber=4 %}

{% stepDescription title="4. Add New Service" %}


Adding ingestion in this step is optional, because we will fetch the metadata from Amundsen. After creating all
the database services, `my service` page looks like below, and we are ready to start with the Amundsen ingestion via the CLI.


{% /stepDescription %}

{% stepVisualInfo %}

{% image
  src="/images/v0.13.3/openmetadata/connectors/amundsen/create-service-4.png"
  alt="db-service" /%}
{% image
  src="/images/v0.13.3/openmetadata/connectors/amundsen/create-service-5.png"
  alt="db-service" /%}

{% /stepVisualInfo %}

{% /step %}

{% /stepsContainer %}



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
