---
title: Snowflake Connection | OpenMetadata Snowflake
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/snowflakeconnection
---

# SnowflakeConnection

*Snowflake Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/snowflakeType](#definitions/snowflakeType)*. Default: `"Snowflake"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/snowflakeScheme](#definitions/snowflakeScheme)*. Default: `"snowflake"`.
- **`username`** *(string)*: Username to connect to Snowflake. This user should have privileges to read all the metadata in Snowflake.
- **`password`** *(string, format: password)*: Password to connect to Snowflake.
- **`account`** *(string)*: If the Snowflake URL is https://xyz1234.us-east-1.gcp.snowflakecomputing.com, then the account is xyz1234.us-east-1.gcp.
- **`role`** *(string)*: Snowflake Role.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`warehouse`** *(string)*: Snowflake warehouse.
- **`queryTag`** *(string)*: Session query tag used to monitor usage on snowflake. To use a query tag snowflake user should have enough privileges to alter the session.
- **`privateKey`** *(string, format: password)*: Connection to Snowflake instance via Private Key.
- **`snowflakePrivatekeyPassphrase`** *(string, format: password)*: Snowflake Passphrase Key used with Private Key.
- **`includeTransientTables`** *(boolean)*: Optional configuration for ingestion of TRANSIENT tables, By default, it will skip the TRANSIENT tables. Default: `false`.
- **`includeStreams`** *(boolean)*: Optional configuration for ingestion of streams, By default, it will skip the streams. Default: `false`.
- **`clientSessionKeepAlive`** *(boolean)*: Optional configuration for ingestion to keep the client session active in case the ingestion process runs for longer durations. Default: `false`.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsUsageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsUsageExtraction](#/connectionBasicType.json#/definitions/supportsUsageExtraction)*.
- **`supportsLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsLineageExtraction](#/connectionBasicType.json#/definitions/supportsLineageExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsDatabase`**: Refer to *[../connectionBasicType.json#/definitions/supportsDatabase](#/connectionBasicType.json#/definitions/supportsDatabase)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`supportsSystemProfile`**: Refer to *[../connectionBasicType.json#/definitions/supportsSystemProfile](#/connectionBasicType.json#/definitions/supportsSystemProfile)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
- **`supportsDataDiff`**: Refer to *[../connectionBasicType.json#/definitions/supportsDataDiff](#/connectionBasicType.json#/definitions/supportsDataDiff)*.
## Definitions

- **`snowflakeType`** *(string)*: Service type. Must be one of: `["Snowflake"]`. Default: `"Snowflake"`.
- **`snowflakeScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["snowflake"]`. Default: `"snowflake"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
