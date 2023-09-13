---
title: Run DomoDatabase Connector using the CLI
slug: /connectors/database/domo-database/cli
---

# Run Domo Database using the metadata CLI

{% multiTablesWrapper %}

| Feature            | Status                       |
| :----------------- | :--------------------------- |
| Stage              | PROD                         |
| Metadata           | {% icon iconName="check" /%} |
| Query Usage        | {% icon iconName="cross" /%} |
| Data Profiler      | {% icon iconName="check" /%} |
| Data Quality       | {% icon iconName="check" /%} |
| Lineage            | Partially via Views          |
| DBT                | {% icon iconName="check" /%} |
| Supported Versions | --                           |

| Feature      | Status                       |
| :----------- | :--------------------------- |
| Lineage      | Partially via Views          |
| Table-level  | {% icon iconName="check" /%} |
| Column-level | {% icon iconName="check" /%} |

{% /multiTablesWrapper %}

In this section, we provide guides and references to use the Domo Database connector.

Configure and schedule DomoDatabase metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [dbt Integration](#dbt-integration)

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{%/inlineCallout%}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

**Note:**

For metadata ingestion, kindly make sure add alteast `data` scopes to the clientId provided.
Question related to scopes, click [here](https://developer.domo.com/portal/1845fc11bbe5d-api-authentication).


### Python Requirements

To run the DomoDatabase ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[domo]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/athenaConnection.json)
you can find the structure to create a connection to DomoDatbase.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for DomoDatabase:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**Client ID**: Client ID to Connect to DOMODatabase.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**Secret Token**: Secret Token to Connect DOMODatabase.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**Access Token**: Access to Connect to DOMODatabase.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**API Host**:  API Host to Connect to DOMODatabase instance.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**SandBox Domain**: Connect to SandBox Domain.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**database**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name

{% /codeInfo %}

#### Source Configuration - Source Config

{% codeInfo srNumber=7 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json):

**markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.

**includeTables**: true or false, to ingest table data. Default is true.

**includeViews**: true or false, to ingest views definitions.

**databaseFilterPattern**, **schemaFilterPattern**, **tableFilterPattern**: Note that the filter supports regex as include or exclude. You can find examples [here](/connectors/ingestion/workflows/metadata/filter-patterns/database)

{% /codeInfo %}

#### Sink Configuration

{% codeInfo srNumber=8 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=9 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

#### Advanced Configuration

{% codeInfo srNumber=10 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=11 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: domodatabase
  serviceName: local_DomoDatabase
  serviceConnection:
    config:
      type: DomoDashboard
```
```yaml {% srNumber=1 %}
      clientId: client-id
```
```yaml {% srNumber=2 %}
      secretToken: secret-token
```
```yaml {% srNumber=3 %}
      accessToken: access-token
```
```yaml {% srNumber=4 %}
      apiHost: api.domo.com
```
```yaml {% srNumber=5 %}
      sandboxDomain: https://<api_domo>.domo.com
```
```yaml {% srNumber=6 %}
      # database: database
```
```yaml {% srNumber=7 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=8 %}
      # connectionArguments:
      #   key: value
```


```yaml {% srNumber=9 %}
  sourceConfig:
    config:
      type: DatabaseMetadata
      markDeletedTables: true
      includeTables: true
      includeViews: true
      # includeTags: true
      # databaseFilterPattern:
      #   includes:
      #     - database1
      #     - database2
      #   excludes:
      #     - database3
      #     - database4
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
      # tableFilterPattern:
      #   includes:
      #     - users
      #     - type_test
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=10 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=11 %}
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

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```bash
metadata ingest -c <path-to-yaml>
```

Note that from connector to connector, this recipe will always be the same. By updating the YAML configuration,
you will be able to extract metadata from different sources.

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}

## Related

{% tilesContainer %}

{% tile
    title="Ingest with Airflow"
    description="Configure the ingestion using Airflow SDK"
    link="/connectors/database/domo-database/airflow"
  / %}

{% /tilesContainer %}