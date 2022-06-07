---
description: Use the 'metadata' CLI to run a one-time ingestion
---

# Amundsen

Configure and schedule Amundsen **metadata** workflows using the `metadata` CLI.

* [Requirements](amundsen.md#requirements)
* [Metadata Ingestion](amundsen.md#metadata-ingestion)

## Requirements

Follow this [guide](https://docs.open-metadata.org/overview/run-openmetadata#procedure) to learn how to install the `metadata` CLI.

In order to execute the workflows, you will need a running OpenMetadata server.&#x20;

### Python requirements

To run the Amundsen ingestion, you will need to install:

```
pip3 install 'openmetadata-ingestion[amundsen]'
```

Note: Make sure you are running  `openmetadata-ingestion` version 0.10.2 or above.

### Create Database Services

You need to create database services before ingesting the metadata from Amundsen.&#x20;

In the below example we have 5 tables from 3 data sources i.e hive, dynamo & delta so in OpenMetadata we have to create database services with the same name as the source.

![Amundsen dashboard](<../../.gitbook/assets/image (3).png>)

To create database service follow these steps

### 1. Visit the _Services_ Page <a href="#1.-visit-the-services-page" id="1.-visit-the-services-page"></a>

The first step is ingesting the metadata from your sources. Under Settings you will find a **Services** link an external source system to OpenMetadata. Once a service is created, it can be used to configure metadata, usage, and profiler workflows.To visit the _Services_ page, select _Services_ from the _Settings_ menu.\


![Navigate to Settings >> Services](https://1627621137-files.gitbook.io/\~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FXztAI0iox9PPEym7VTye%2Fuploads%2Fgit-blob-b4d98517ea6565137da86128df9f83855767cc05%2Fimage.png?alt=media)

### 2. Create a New Service

Click on the _Add New Service_ button to start the Service creation.

![Add a New Service from the Database Services Page](<../../.gitbook/assets/image (61).png>)

### 3. Select the Service Type

Select the service type which are available on the amundsen and create a service one by one. In this example we will need to create services for hive, dynamo db & deltalake. Possible service names are `athena, bigquery, db2, druid, delta, salesforce, oracle, glue, snowflake, hive` .

![](<../../.gitbook/assets/image (1).png>)

![Service Created](<../../.gitbook/assets/image (45).png>)

Note: Adding ingestion in this step is optional, because we will fetch the metadata from amundsen.

After creating all the database services, my service page looks like below and we are ready to start with the amundsen ingestion via cli.

![](<../../.gitbook/assets/image (79).png>)

## Metadata Ingestion

Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/metadata/amundsenConnection.json) you can find the structure to create a connection to Snowflake.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a YAML configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/metadata/amundsenConnection.json).

### 1. Define the YAML Config

This is a sample config for Snowflake:

```json
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
      modelClass: <modelclass>
  sourceConfig:
    config:
      enableDataProfiler: false
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth

```

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json).

* **username**: Enter the username of your amundsen user in the _Username_ field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow.
* **password**: Enter the password for your amundsen user in the _Password_ field.
* **hostPort:** Host and port of the Amundsen Neo4j Connection.
* **maxConnectionLifeTime (optional):** Maximum connection lifetime for the Amundsen Neo4j Connection
* **validateSSL (optional)**: Enable SSL validation for the Amundsen Neo4j Connection.
* **encrypted** (Optional): Enable encryption for the Amundsen Neo4j Connection.
* **modelClass** (Optional): Model Class for the Amundsen Neo4j Connection.

For the Connection Arguments, In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows.

`"authenticator" : "sso_login_url"`

In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows.

`"authenticator" : "externalbrowser"`&#x20;

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```

#### OpenMetadata Security Providers

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/security/client). An example of an Auth0 configuration would be the following:

```
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: auth0
    securityConfig:
      clientId: <client ID>
      secretKey: <secret key>
      domain: <domain>
```

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the JSON configuration, you will be able to extract metadata from different sources.
