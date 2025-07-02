---
title: Run the MSSQL Connector Externally
description: Configure MS SQL Server database connections in OpenMetadata using YAML. Step-by-step setup guide with examples, authentication options, and troubleshooting tips.
slug: /connectors/database/mssql/yaml
---

{% connectorDetailsHeader
name="MSSQL"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "dbt", "Lineage", "Column-level Lineage", "Stored Procedures", "Sample Data", "Reverse Metadata (Collate Only)"]
unavailableFeatures=["Owners", "Tags", "SSIS packages"]
/ %}

In this section, we provide guides and references to use the MSSQL connector.

Configure and schedule MSSQL metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](#query-usage)
- [Lineage](#lineage)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)
{% collateContent %}
- [Reverse Metadata](/connectors/ingestion/workflows/reverse-metadata)
{% /collateContent %}
{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

## Requirements

MSSQL User must grant `SELECT` privilege to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

### Usage & Lineage consideration

To perform the query analysis for Usage and Lineage computation, we fetch the query logs from `sys.dm_exec_cached_plans`, `sys.dm_exec_query_stats` &  `sys.dm_exec_sql_text` system tables. To access these tables your user must have `VIEW SERVER STATE` privilege.

```sql
GRANT VIEW SERVER STATE TO YourUser;
```

### Python Requirements

{% partial file="/v1.9/connectors/python-requirements.md" /%}

To run the MSSQL ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[mssql]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/mssqlConnection.json)
you can find the structure to create a connection to MSSQL.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for MSSQL:


{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**scheme**: Defines how to connect to MSSQL. We support `mssql+pytds`, `mssql+pyodbc`, and `mssql+pymssql`.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**username**: Specify the User to connect to MSSQL. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**password**: Password to connect to MSSQL.

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**hostPort**: Enter the fully qualified hostname and port number for your MSSQL deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**database**: The initial database to establish a connection to the data source.

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**ingestAllDatabases**: If you need to ingest multiple databases - aside from the initial one above - you can enable this option.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**uriString**: In case of a `pyodbc` connection.

{% /codeInfo %}


{% partial file="/v1.9/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=8 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=9 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: mssql
  serviceName: "<service name>"
  serviceConnection:
    config:
      type: Mssql
      username: <username>
      password: <password>
      hostPort: <hostPort>
      database: <database>  # REQUIRED - database name
```
```yaml {% srNumber=8 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=9 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.9/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.9/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.9/connectors/yaml/query-usage.md" variables={connector: "mssql"} /%}

{% partial file="/v1.9/connectors/yaml/lineage.md" variables={connector: "mssql"} /%}

{% partial file="/v1.9/connectors/yaml/data-profiler.md" variables={connector: "mssql"} /%}

{% partial file="/v1.9/connectors/yaml/auto-classification.md" variables={connector: "mssql"} /%}

{% partial file="/v1.9/connectors/yaml/data-quality.md" /%}

## dbt Integration

You can learn more about how to ingest dbt models' definitions and their lineage [here](/connectors/ingestion/workflows/dbt).
