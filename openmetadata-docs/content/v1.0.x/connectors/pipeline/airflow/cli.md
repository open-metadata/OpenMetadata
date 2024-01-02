---
title: Run Airflow Connector using the CLI
slug: /connectors/pipeline/airflow/cli
---

# Run Airflow using the metadata CLI

In this section, we provide guides and references to use the Airbyte connector.

Configure and schedule Airbyte metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

## Requirements

{%inlineCallout icon="description" bold="OpenMetadata 0.12 or later" href="/deployment"%}
To deploy OpenMetadata, check the Deployment guides.
{% /inlineCallout %}

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

### Python Requirements

To run the Airflow ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[airflow]"
```

Note that this installs the same Airflow version that we ship in the Ingestion Container, which is
Airflow `2.3.3` from Release `0.12`.

The ingestion using Airflow version 2.3.3 as a source package has been tested against Airflow 2.3.3 and Airflow 2.2.5.

**Note:** we only support officially supported Airflow versions. You can check the version list [here](https://airflow.apache.org/docs/apache-airflow/stable/installation/supported-versions.html).

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/airbyteConnection.json)
you can find the structure to create a connection to Airbyte.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Airbyte:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

- 
- 
**connection**: Airflow metadata database connection. See
  these [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html)
  for supported backends.

In terms of `connection` we support the following selections:

- `backend`: Should not be used from the UI. This is only applicable when ingesting Airflow metadata locally by running
  the ingestion from a DAG. It will use the current Airflow SQLAlchemy connection to extract the data.
- `MySQL`, `Postgres`, `MSSQL` and `SQLite`: Pass the required credentials to reach out each of these services. We will
  create a connection to the pointed database and read Airflow data from there.

**hostPort**: URL to the Airflow instance.


{% /codeInfo %}

{% codeInfo srNumber=1 %}

**numberOfStatus**: Number of status we want to look back to in every ingestion (e.g., Past executions from a DAG).



{% /codeInfo %}

{% codeInfo srNumber=1 %}

**connection**: Airflow metadata database connection. See
  these [docs](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html)
  for supported backends.

In terms of `connection` we support the following selections:

- `backend`: Should not be used from the UI. This is only applicable when ingesting Airflow metadata locally by running
  the ingestion from a DAG. It will use the current Airflow SQLAlchemy connection to extract the data.
- `MySQL`, `Postgres`, `MSSQL` and `SQLite`: Pass the required credentials to reach out each of these services. We will
  create a connection to the pointed database and read Airflow data from there.

{% /codeInfo %}



#### Source Configuration - Source Config

{% codeInfo srNumber=5 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/pipelineServiceMetadataPipeline.json):

**dbServiceNames**: Database Service Name for the creation of lineage, if the source supports it.

**includeTags**: Set the 'Include Tags' toggle to control whether to include tags as part of metadata ingestion.

**markDeletedPipelines**: Set the Mark Deleted Pipelines toggle to flag pipelines as soft-deleted if they are not present anymore in the source system.

**pipelineFilterPattern** and **chartFilterPattern**: Note that the `pipelineFilterPattern` and `chartFilterPattern` both support regex as include or exclude.

{% /codeInfo %}


#### Sink Configuration

{% codeInfo srNumber=6 %}

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.

{% /codeInfo %}

#### Workflow Configuration

{% codeInfo srNumber=7 %}

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: airflow
  serviceName: airflow_source
  serviceConnection:
    config:
      type: Airflow
```
```yaml {% srNumber=6 %}
      hostPort: http://localhost:8080
```
```yaml {% srNumber=6 %}
      numberOfStatus: 10
```
```yaml {% srNumber=6 %}
      # Connection needs to be one of Mysql, Postgres, Mssql or Sqlite
      connection:
        type: Mysql
        username: airflow_user
        password: airflow_pass
        databaseSchema: airflow_db
        hostPort: localhost:3306
        # #
        # type: Postgres
        # username: airflow_user
        # password: airflow_pass
        # database: airflow_db
        # hostPort: localhost:3306
        # #
        # type: Mssql
        # username: airflow_user
        # password: airflow_pass
        # database: airflow_db
        # hostPort: localhost:3306
        # uriString: http://... (optional)
        # #
        # type: Sqlite
        # username: airflow_user
        # password: airflow_pass
        # database: airflow_db
        # hostPort: localhost:3306
        # databaseMode: ":memory:" (optional)
```
```yaml {% srNumber=6 %}
  sourceConfig:
    config:
      type: PipelineMetadata
      # markDeletedPipelines: True
      # includeTags: True
      # includeLineage: true
      # pipelineFilterPattern:
      #   includes:
      #     - pipeline1
      #     - pipeline2
      #   excludes:
      #     - pipeline3
      #     - pipeline4
```
```yaml {% srNumber=6 %}
sink:
  type: metadata-rest
  config: {}
```

```yaml {% srNumber=7 %}
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

