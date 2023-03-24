## Requirements

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

To ingest basic metadata snowflake user must have the following priviledges:
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

You can find more information about the `account_usage` schema [here](https://docs.snowflake.com/en/sql-reference/account-usage.html).
