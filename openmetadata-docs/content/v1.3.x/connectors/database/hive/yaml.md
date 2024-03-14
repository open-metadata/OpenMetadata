---
title: Run the Hive Connector Externally
slug: /connectors/database/hive/yaml
---

{% connectorDetailsHeader
name="Hive"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "View Lineage", "View Column-level Lineage", "dbt"]
unavailableFeatures=["Query Usage", "Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Hive connector.

Configure and schedule Hive metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

To run the Hive ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[hive]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/hiveConnection.json)
you can find the structure to create a connection to Hive.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Hive:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Hive. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Hive.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: Enter the fully qualified hostname and port number for your Hive deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**authOptions**: Enter the auth options string for hive connection.

{% /codeInfo %}


{% codeInfo srNumber=22 %}

#### For MySQL Metastore Connection:
You can also ingest the metadata using Mysql metastore. This step is optional if metastore details are not provided then we will query the hive server directly.

- **username**: Specify the User to connect to MySQL Metastore. It should have enough privileges to read all the metadata.
- **password**: Password to connect to MySQL.
- **hostPort**: Enter the fully qualified hostname and port number for your MySQL Metastore deployment in the Host and Port field in the format `hostname:port`.
- **databaseSchema**: Enter the database schema which is associated with the metastore.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

#### For Postgres Metastore Connection:

You can also ingest the metadata using Postgres metastore. This step is optional if metastore details are not provided then we will query the hive server directly.

- **username**: Specify the User to connect to Postgres Metastore. It should have enough privileges to read all the metadata.
- **password**: Password to connect to Postgres.
- **hostPort**: Enter the fully qualified hostname and port number for your Postgres deployment in the Host and Port field in the format `hostname:port`.
- **database**: Initial Postgres database to connect to. Specify the name of database associated with metastore instance.

{% /codeInfo %}


{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=5 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml
source:
  type: hive
  serviceName: local_hive
  serviceConnection:
    config:
      type: Hive
```
```yaml {% srNumber=1 %}
      username: <username>
```
```yaml {% srNumber=2 %}
      password: <password>
```
```yaml {% srNumber=3 %}
      authOptions: <auth options>
```
```yaml {% srNumber=4 %}
      hostPort: <hive connection host & port>
```

```yaml {% srNumber=22 %}
      # For MySQL Metastore Connection
      # metastoreConnection:
      #   type: Mysql
      #   username: <username>
      #   authType:
      #     password: <password>
      #   hostPort: <hostPort>
      #   databaseSchema: metastore

```
```yaml {% srNumber=23 %}
      # For Postgres Metastore Connection
      # metastoreConnection:
      #   type: Postgres
      #   username: <username>
      #   authType:
      #     password: <password>
      #   hostPort: <hostPort>
      #   database: metastore
```
```yaml {% srNumber=5 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=6 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}
{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.3/connectors/yaml/data-profiler.md" variables={connector: "hive"} /%}

{% partial file="/v1.3/connectors/yaml/data-quality.md" /%}

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
