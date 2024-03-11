---
title: Run the Oracle Connector Externally
slug: /connectors/database/oracle/yaml
---

{% connectorDetailsHeader
name="Oracle"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures"]
unavailableFeatures=["Owners", "Tags"]
/ %}

In this section, we provide guides and references to use the Oracle connector.

Configure and schedule Oracle metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [Lineage](#lineage)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

**Note**: To retrieve metadata from an Oracle database, the python-oracledb library can be utilized, which provides support for versions 12c, 18c, 19c, and 21c.

To ingest metadata from oracle user must have `CREATE SESSION` privilege for the user.

```sql
-- CREATE USER
CREATE USER user_name IDENTIFIED BY admin_password;

-- CREATE ROLE
CREATE ROLE new_role;

-- GRANT ROLE TO USER 
GRANT new_role TO user_name;

-- GRANT CREATE SESSION PRIVILEGE TO USER
GRANT CREATE SESSION TO new_role;
```

With just these permissions, your user should be able to ingest the schemas, but not the tables inside them. To get
the tables, you should grant `SELECT` permissions to the tables you are interested in. E.g.,

```sql
SELECT ON ADMIN.EXAMPLE_TABLE TO new_role;
```

You can find further information [here](https://docs.oracle.com/javadb/10.8.3.0/ref/rrefsqljgrant.html). Note that
there is no routine out of the box in Oracle to grant SELECT to a full schema.

### Python Requirements

To run the Oracle ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[oracle]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/oracleConnection.json)
you can find the structure to create a connection to Oracle.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Oracle:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Oracle. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Oracle.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**hostPort**: Enter the fully qualified hostname and port number for your Oracle deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**oracleConnectionType** :
- **oracleServiceName**: The Oracle Service name is the TNS alias that you give when you remotely connect to your database and this Service name is recorded in tnsnames.
- **databaseSchema**: The name of the database schema available in Oracle that you want to connect with.
- **Oracle instant client directory**: The directory pointing to where the `instantclient` binaries for Oracle are located. In the ingestion Docker image we
    provide them by default at `/instantclient`. If this parameter is informed (it is by default), we will run the [thick oracle client](https://python-oracledb.readthedocs.io/en/latest/user_guide/initialization.html#initializing-python-oracledb).
    We are shipping the binaries for ARM and AMD architectures from [here](https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html)
    and [here](https://www.oracle.com/database/technologies/instant-client/linux-arm-aarch64-downloads.html) for the instant client version 19.

{% /codeInfo %}

{% codeInfo srNumber=23 %}

**databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name. It is recommended to use the database name same as the SID, This ensures accurate results and proper identification of tables during profiling, data quality checks and dbt workflow.

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
  type: oracle
  serviceName: local_oracle
  serviceConnection:
    config:
      type: Oracle
```
```yaml {% srNumber=1 %}
      hostPort: hostPort
```
```yaml {% srNumber=2 %}
      username: username
```
```yaml {% srNumber=3 %}
      password: password
```
```yaml {% srNumber=4 %}
      # The type can either be oracleServiceName or databaseSchema
      oracleConnectionType:
        oracleServiceName: serviceName
        # databaseSchema: schema
```
```yaml {% srNumber=23 %}
      databaseName: custom_db_display_name
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

{% partial file="/v1.3/connectors/yaml/data-profiler.md" variables={connector: "oracle"} /%}

{% partial file="/v1.3/connectors/yaml/data-quality.md" /%}

## Lineage

You can learn more about how to ingest lineage [here](/connectors/ingestion/workflows/lineage).

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}

