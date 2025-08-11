---
title: Oracle Connection | OpenMetadata Oracle Database Connection
description: Define Oracle database connection schema for ingesting schema details, table metadata, and lineage.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/oracleconnection
---

# OracleConnection

*Oracle Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/oracleType](#definitions/oracleType)*. Default: `"Oracle"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/oracleScheme](#definitions/oracleScheme)*. Default: `"oracle+cx_oracle"`.
- **`username`** *(string)*: Username to connect to Oracle. This user should have privileges to read all the metadata in Oracle.
- **`password`** *(string, format: password)*: Password to connect to Oracle.
- **`hostPort`** *(string)*: Host and port of the Oracle service.
- **`oracleConnectionType`** *(object)*: Connect with oracle by either passing service name or database schema name.
  - **One of**
    - : Refer to *[#/definitions/OracleDatabaseSchema](#definitions/OracleDatabaseSchema)*.
    - : Refer to *[#/definitions/OracleServiceName](#definitions/OracleServiceName)*.
    - : Refer to *[#/definitions/OracleTNSConnection](#definitions/OracleTNSConnection)*.
- **`instantClientDirectory`** *(string)*: This directory will be used to set the LD_LIBRARY_PATH env variable. It is required if you need to enable thick connection mode. By default, we bring instant client 19 and point to /instantclient. Default: `"/instantclient"`.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsUsageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsUsageExtraction](#/connectionBasicType.json#/definitions/supportsUsageExtraction)*.
- **`supportsLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsLineageExtraction](#/connectionBasicType.json#/definitions/supportsLineageExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`supportsDataDiff`**: Refer to *[../connectionBasicType.json#/definitions/supportsDataDiff](#/connectionBasicType.json#/definitions/supportsDataDiff)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
## Definitions

- **`oracleType`** *(string)*: Service type. Must be one of: `["Oracle"]`. Default: `"Oracle"`.
- **`oracleScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["oracle+cx_oracle"]`. Default: `"oracle+cx_oracle"`.
- **`OracleDatabaseSchema`** *(object)*
  - **`databaseSchema`** *(string, required)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`OracleServiceName`** *(object)*
  - **`oracleServiceName`** *(string, required)*: The Oracle Service name is the TNS alias that you give when you remotely connect to your database.
- **`OracleTNSConnection`** *(object)*
  - **`oracleTNSConnection`** *(string, required)*: Pass the full constructed TNS string, e.g., (DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1530)))(CONNECT_DATA=(SID=MYSERVICENAME))).


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
