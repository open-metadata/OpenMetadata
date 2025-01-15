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
    - [Incremental Extraction](/connectors/ingestion/workflows/metadata/incremental-extraction/snowflake)
- [Query Usage](/connectors/ingestion/workflows/usage)
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [Lineage](/connectors/ingestion/lineage)
- [dbt Integration](/connectors/ingestion/workflows/dbt)

{% partial file="/v1.6/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/snowflake/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/snowflake/connections) user credentials with the Snowflake connector.

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
```

{% note %}
If running any of:
  - Incremental Extraction
  - Ingesting Tags
  - Usage Workflow

The following Grant is needed
{% /note %}

- **Incremental Extraction**: Openmetadata fetches the information by querying `snowflake.account_usage.tables`.

- **Ingesting Tags**: Openmetadata fetches the information by querying `snowflake.account_usage.tag_references`.

- **Usage Workflow**: Openmetadata fetches the query logs by querying `snowflake.account_usage.query_history` table. For this the snowflake user should be granted the `ACCOUNTADMIN` role or a role granted IMPORTED PRIVILEGES on the database `SNOWFLAKE`.

In order to be able to query those tables, the user should be either granted the `ACCOUNTADMIN` role or a role with the `IMPORTED PRIVILEGES` grant on the `SNOWFLAKE` database:

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
  file="/v1.6/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Snowflake", 
    selectServicePath: "/images/v1.6/connectors/snowflake/select-service.png",
    addNewServicePath: "/images/v1.6/connectors/snowflake/add-new-service.png",
    serviceConnectionPath: "/images/v1.6/connectors/snowflake/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.6/connectors/test-connection.md" /%}

{% partial file="/v1.6/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.6/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.6/connectors/troubleshooting.md" /%}

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

{% partial file="/v1.6/connectors/database/related.md" /%}
