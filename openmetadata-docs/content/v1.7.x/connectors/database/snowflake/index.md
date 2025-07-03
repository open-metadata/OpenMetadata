---
title: Snowflake Connector | OpenMetadata Cloud Data Warehouse
description: Connect Snowflake to OpenMetadata seamlessly with our database connector. Extract metadata, lineage, and profiling data from your Snowflake warehouse effortlessly.
slug: /connectors/database/snowflake
---

{% connectorDetailsHeader
name="Snowflake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Stored Procedures", "Tags", "Sample Data", "Reverse Metadata (Collate Only)"]
unavailableFeatures=[]
/ %}


In this section, we provide guides and references to use the Snowflake connector.

Configure and schedule Snowflake metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
    - [Incremental Extraction](/connectors/ingestion/workflows/metadata/incremental-extraction/snowflake)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/snowflake/troubleshooting)
{% collateContent %}
- [Reverse Metadata](#reverse-metadata)
{% /collateContent %}

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/snowflake/yaml"} /%}

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
GRANT SELECT ON ALL DYNAMIC TABLES IN SCHEMA TEST_SCHEMA TO ROLE NEW_ROLE;

-- Grant IMPORTED PRIVILEGES on all Schemas of SNOWFLAKE DB to New Role, 
-- optional but required for usage, lineage and stored procedure ingestion
GRANT IMPORTED PRIVILEGES ON ALL SCHEMAS IN DATABASE SNOWFLAKE TO ROLE NEW_ROLE;
```

{% note %}
If running any of:
  - Incremental Extraction
  - Ingesting Tags
  - Ingesting Stored Procedures
  - Lineage & Usage Workflow

The following Grant is needed
{% /note %}

- **Incremental Extraction**: Openmetadata fetches the information by querying `snowflake.account_usage.tables`.

- **Ingesting Tags**: Openmetadata fetches the information by querying `snowflake.account_usage.tag_references`.

- **Lineage & Usage Workflow**: Openmetadata fetches the query logs by querying `snowflake.account_usage.query_history` table. For this the snowflake user should be granted the `ACCOUNTADMIN` role or a role granted IMPORTED PRIVILEGES on the database `SNOWFLAKE`.

You can find more information about the `account_usage` schema [here](https://docs.snowflake.com/en/sql-reference/account-usage).

- **Ingesting Stored Procedures**: Openmetadata fetches the information by querying `snowflake.account_usage.procedures` & `snowflake.account_usage.functions`.

## Metadata Ingestion

{% partial 
  file="/v1.7/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Snowflake", 
    selectServicePath: "/images/v1.7/connectors/snowflake/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/snowflake/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/snowflake/service-connection.png",
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
- **Include Streams**:
Optional configuration for ingestion of streams, By default, it will skip the streams.
- **Client Session Keep Alive**: Optional Configuration to keep the session active in case the ingestion job runs for longer duration.
- **Account Usage Schema Name**: Full name of account usage schema, used in case your used do not have direct access to `SNOWFLAKE.ACCOUNT_USAGE` schema. In such case you can replicate tables `QUERY_HISTORY`, `TAG_REFERENCES`, `PROCEDURES`, `FUNCTIONS` to a custom schema let's say `CUSTOM_DB.CUSTOM_SCHEMA` and provide the same name in this field.

When using this field make sure you have all these tables available within your custom schema  `QUERY_HISTORY`, `TAG_REFERENCES`, `PROCEDURES`, `FUNCTIONS`.

{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

### Incomplete Column Level for Views

For views with a tag or policy, you may see incorrect lineage, this can be because user may not have enough access to fetch those policies or tags. You need to grant the following privileges in order to fix it.
checkout [snowflake docs](https://docs.snowflake.com/en/sql-reference/functions/get_ddl#usage-notes) for further details.

```
GRANT APPLY MASKING POLICY TO ROLE NEW_ROLE;
GRANT APPLY ROW ACCESS POLICY TO ROLE NEW_ROLE;
GRANT APPLY AGGREGATION POLICY TO ROLE NEW_ROLE;
GRANT APPLY PROJECTION POLICY TO ROLE NEW_ROLE;
GRANT APPLY TAG TO ROLE NEW_ROLE;
```

Depending on your view ddl you can grant the relevant privileged as per above queries.

{% collateContent %}
{% partial file="/v1.7/connectors/database/snowflake/reverse-metadata.md" /%}
{% /collateContent %}

{% partial file="/v1.7/connectors/database/related.md" /%}
