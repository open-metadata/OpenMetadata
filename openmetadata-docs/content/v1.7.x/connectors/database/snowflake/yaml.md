---
title: Run the Snowflake Connector Externally
description: Integrate Yaml with Collate for metadata sync, profiling, and lineage. Start configuring with our easy-to-follow guide.
slug: /connectors/database/snowflake/yaml
---

{% connectorDetailsHeader
name="Snowflake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Stored Procedures", "Tags", "Sample Data", "Reverse Metadata (Collate Only)", "Auto-Classification"]
unavailableFeatures=[]
/ %}

In this section, we provide guides and references to use the Snowflake connector.

Configure and schedule Snowflake metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Incremental Extraction](/connectors/ingestion/workflows/metadata/incremental-extraction/snowflake)
- [Query Usage](#query-usage)
- [Lineage](#lineage)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)
{% collateContent %}
- [Reverse Metadata](/connectors/ingestion/workflows/reverse-metadata)
{% /collateContent %}

{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the Snowflake ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[snowflake]"
```

If you want to run the Usage Connector, you'll also need to install:

```bash
pip3 install "openmetadata-ingestion[snowflake-usage]"
```
To ingest basic metadata snowflake user must have the following privileges:
  - `USAGE` Privilege on Warehouse
  - `USAGE` Privilege on Database
  - `USAGE` Privilege on Schema
  - `SELECT` Privilege on Tables
```sql
-- Create New Role
CREATE ROLE NEW_ROLE;

-- Create New User
CREATE USER NEW_USER DEFAULT_ROLE=NEW_ROLE PASSWORD='PASSWORD';

-- Grant role to user
GRANT ROLE NEW_ROLE TO USER NEW_USER;

-- Grant USAGE Privilege on Warehouse to New Role
GRANT USAGE ON WAREHOUSE WAREHOUSE_NAME TO ROLE NEW_ROLE;

-- Grant USAGE Privilege on Database to New Role
GRANT USAGE ON DATABASE TEST_DB TO ROLE NEW_ROLE;

-- Grant USAGE Privilege on required Schemas to New Role
GRANT USAGE ON SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;

-- Grant SELECT Privilege on required tables & views to New Role
GRANT SELECT ON ALL TABLES IN SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;
GRANT SELECT ON ALL EXTERNAL TABLES IN SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;
GRANT SELECT ON ALL VIEWS IN SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;
GRANT SELECT ON ALL DYNAMIC TABLES IN SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;
```


While running the usage workflow, Openmetadata fetches the query logs by querying `snowflake.account_usage.query_history` table. For this the snowflake user should be granted the `ACCOUNTADMIN` role or a role granted IMPORTED PRIVILEGES on the database `SNOWFLAKE`.

```sql

-- Grant IMPORTED PRIVILEGES on all Schemas of SNOWFLAKE DB to New Role
GRANT IMPORTED PRIVILEGES ON ALL SCHEMAS IN DATABASE SNOWFLAKE TO ROLE NEW_ROLE;

```


If ingesting tags, the user should also have permissions to query `snowflake.account_usage.tag_references`.For this the snowflake user should be granted the `ACCOUNTADMIN` role or a role granted IMPORTED PRIVILEGES on the database

```sql

-- Grant IMPORTED PRIVILEGES on all Schemas of SNOWFLAKE DB to New Role
GRANT IMPORTED PRIVILEGES ON ALL SCHEMAS IN DATABASE SNOWFLAKE TO ROLE NEW_ROLE;

```

You can find more information about the `account_usage` schema [here](https://docs.snowflake.com/en/sql-reference/account-usage).

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json)
you can find the structure to create a connection to Snowflake.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Snowflake:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to Snowflake. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**password**: Password to connect to Snowflake.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**warehouse**: Snowflake warehouse is required for executing queries to fetch the metadata. Enter the name of warehouse against which you would like to execute these queries.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**account**: Snowflake account identifier uniquely identifies a Snowflake account within your organization, as well as throughout the global network of Snowflake-supported cloud platforms and cloud regions. If the Snowflake URL is `https://xyz1234.us-east-1.gcp.snowflakecomputing.com`, then the account is `xyz1234.us-east-1.gcp`.


{% /codeInfo %}

{% codeInfo srNumber=5 %}

**database**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

{% /codeInfo %}

{% codeInfo srNumber=40 %}

**accountUsageSchema**: Full name of account usage schema, used in case your used do not have direct access to `SNOWFLAKE.ACCOUNT_USAGE` schema. In such case you can replicate tables `QUERY_HISTORY`, `TAG_REFERENCES`, `PROCEDURES`, `FUNCTIONS` to a custom schema let's say `CUSTOM_DB.CUSTOM_SCHEMA` and provide the same name in this field.

When using this field make sure you have all these tables available within your custom schema  `QUERY_HISTORY`, `TAG_REFERENCES`, `PROCEDURES`, `FUNCTIONS`.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**includeTransientTables**: Optional configuration for ingestion of TRANSIENT and TEMPORARY tables, By default, it will skip the TRANSIENT and TEMPORARY tables.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**includeStreams**: Optional configuration for ingestion of streams, By default, it will skip the streams.

{% /codeInfo %}

{% codeInfo srNumber=39 %}

**clientSessionKeepAlive**: Optional Configuration to keep the session active in case the ingestion job runs for longer duration.

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**privateKey**: If you have configured the key pair authentication for the given user you will have to pass the private key associated with the user in this field. You can checkout [this](https://docs.snowflake.com/en/user-guide/key-pair-auth) doc to get more details about key-pair authentication.
  - The multi-line key needs to be converted to one line with `\n` for line endings i.e. `-----BEGIN ENCRYPTED PRIVATE KEY-----\nMII...\n...\n-----END ENCRYPTED PRIVATE KEY-----`

{% /codeInfo %}

{% codeInfo srNumber=9 %}

**snowflakePrivatekeyPassphrase**: If you have configured the encrypted key pair authentication for the given user you will have to pass the paraphrase associated with the private key in this field. You can checkout [this](https://docs.snowflake.com/en/user-guide/key-pair-auth) doc to get more details about key-pair authentication.


{% /codeInfo %}

{% codeInfo srNumber=10 %}

**role**: You can specify the role of user that you would like to ingest with, if no role is specified the default roles assigned to user will be selected.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=11 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: snowflake
  serviceName: <service name>
  serviceConnection:
    config:
      type: Snowflake
```
```yaml {% srNumber=1 %}
      username: <username>
```
```yaml {% srNumber=2 %}
      password: <password>
```
```yaml {% srNumber=3 %}
      warehouse: <warehouse>
```
```yaml {% srNumber=4 %}
      account: <account>
```
```yaml {% srNumber=5 %}
      # database: <database>
```
```yaml {% srNumber=40 %}
      # accountUsageSchema: SNOWFLAKE.ACCOUNT_USAGE
```
```yaml {% srNumber=6 %}
      includeTransientTables: false
```
```yaml {% srNumber=7 %}
      includeStreams: false
```
```yaml {% srNumber=39 %}
      clientSessionKeepAlive: false
```
```yaml {% srNumber=8 %}
      # privateKey: <privateKey>
```
```yaml {% srNumber=9 %}
      # snowflakePrivatekeyPassphrase: <passphrase>
```
```yaml {% srNumber=10 %}
      # role: <role>
```
```yaml {% srNumber=11 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=12 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.7/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}


{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}


{% partial file="/v1.7/connectors/yaml/query-usage.md" variables={connector: "snowflake"} /%}

{% partial file="/v1.7/connectors/yaml/lineage.md" variables={connector: "snowflake"} /%}

{% partial file="/v1.7/connectors/yaml/data-profiler.md" variables={connector: "snowflake"} /%}

{% partial file="/v1.7/connectors/yaml/auto-classification.md" variables={connector: "snowflake"} /%}

{% partial file="/v1.7/connectors/yaml/data-quality.md" /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
