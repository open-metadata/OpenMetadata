---
title: Snowflake
slug: /connectors/database/snowflake
---

{% connectorDetailsHeader
name="Snowflake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Stored Procedures", "Tags"]
unavailableFeatures=["Owners"]
/ %}


In this section, we provide guides and references to use the Snowflake connector.

Configure and schedule Snowflake metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/snowflake/yaml"} /%}

## Requirements

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

Regarding Stored Procedures:
1. Snowflake only allows the grant of `USAGE` or `OWNERSHIP`
2. A user can only see the definition of the procedure in 2 situations:
   1. If it has the `OWNERSHIP` grant,
   2. If it has the `USAGE` grant and the procedure is created with `EXECUTE AS CALLER`.

Make sure to add the `GRANT <USAGE|OWNERSHIP> ON PROCEDURE <NAME>(<SIGNATURE>) to NEW_ROLE`, e.g., `GRANT USAGE ON PROCEDURE CLEAN_DATA(varchar, varchar) to NEW_ROLE`.

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Snowflake", 
    selectServicePath: "/images/v1.3/connectors/snowflake/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/snowflake/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/snowflake/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to Snowflake. It should have enough privileges to read all the metadata.
- **Password**: Password to connect to Snowflake.
- **Account**: Snowflake account identifier uniquely identifies a Snowflake account within your organization, as well as throughout the global network of Snowflake-supported cloud platforms and cloud regions. If the Snowflake URL is `https://xyz1234.us-east-1.gcp.snowflakecomputing.com`, then the account is `xyz1234.us-east-1.gcp`.
- **Role (Optional)**: You can specify the role of user that you would like to ingest with, if no role is specified the default roles assigned to user will be selected.
- **Warehouse**: Snowflake warehouse is required for executing queries to fetch the metadata. Enter the name of warehouse against which you would like to execute these queries.
- **Database (Optional)**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Private Key (Optional)**: If you have configured the key pair authentication for the given user you will have to pass the private key associated with the user in this field. You can checkout [this](https://docs.snowflake.com/en/user-guide/key-pair-auth) doc to get more details about key-pair authentication.
  - The multi-line key needs to be converted to one line with `\n` for line endings i.e. `-----BEGIN ENCRYPTED PRIVATE KEY-----\nMII...\n...\n-----END ENCRYPTED PRIVATE KEY-----`
- **Snowflake Passphrase Key (Optional)**: If you have configured the encrypted key pair authentication for the given user you will have to pass the paraphrase associated with the private key in this field. You can checkout [this](https://docs.snowflake.com/en/user-guide/key-pair-auth) doc to get more details about key-pair authentication.
- **Include Temporary and Transient Tables**: 
Optional configuration for ingestion of `TRANSIENT` and `TEMPORARY` tables, By default, it will skip the `TRANSIENT` and `TEMPORARY` tables.
- **Client Session Keep Alive**: Optional Configuration to keep the session active in case the ingestion job runs for longer duration.

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
