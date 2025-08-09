---
title: snowflakeConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/snowflakeconnection
---

# SnowflakeConnection

*Snowflake Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/snowflakeType*. Default: `Snowflake`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/snowflakeScheme*. Default: `snowflake`.
- **`username`** *(string)*: Username to connect to Snowflake. This user should have privileges to read all the metadata in Snowflake.
- **`password`** *(string)*: Password to connect to Snowflake.
- **`account`** *(string)*: If the Snowflake URL is https://xyz1234.us-east-1.gcp.snowflakecomputing.com, then the account is xyz1234.us-east-1.gcp.
- **`role`** *(string)*: Snowflake Role.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`warehouse`** *(string)*: Snowflake warehouse.
- **`queryTag`** *(string)*: Session query tag used to monitor usage on snowflake. To use a query tag snowflake user should have enough privileges to alter the session.
- **`accountUsageSchema`** *(string)*: Full name of the schema where the account usage data is stored. Default: `SNOWFLAKE.ACCOUNT_USAGE`.
- **`privateKey`** *(string)*: Connection to Snowflake instance via Private Key.
- **`snowflakePrivatekeyPassphrase`** *(string)*: Snowflake Passphrase Key used with Private Key.
- **`includeTransientTables`** *(boolean)*: Optional configuration for ingestion of TRANSIENT tables, By default, it will skip the TRANSIENT tables. Default: `False`.
- **`includeStreams`** *(boolean)*: Optional configuration for ingestion of streams, By default, it will skip the streams. Default: `False`.
- **`clientSessionKeepAlive`** *(boolean)*: Optional configuration for ingestion to keep the client session active in case the ingestion process runs for longer durations. Default: `False`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*. Default: `{'includes': [], 'excludes': ['^information_schema$']}`.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*. Default: `{'includes': [], 'excludes': ['^snowflake$']}`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsIncrementalMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsIncrementalMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`supportsSystemProfile`**: Refer to *../connectionBasicType.json#/definitions/supportsSystemProfile*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsDataDiff`**: Refer to *../connectionBasicType.json#/definitions/supportsDataDiff*.
- **`creditCost`** *(number)*: Cost of credit for the Snowflake account. Default: `3.3`.
## Definitions

- **`snowflakeType`** *(string)*: Service type. Must be one of: `['Snowflake']`. Default: `Snowflake`.
- **`snowflakeScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['snowflake']`. Default: `snowflake`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
