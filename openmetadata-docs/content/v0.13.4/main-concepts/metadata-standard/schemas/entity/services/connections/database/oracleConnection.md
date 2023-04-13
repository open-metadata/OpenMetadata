---
title: oracleConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/oracleconnection
---

# OracleConnection

*Oracle Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/oracleType*. Default: `Oracle`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/oracleScheme*. Default: `oracle+cx_oracle`.
- **`username`** *(string)*: Username to connect to Oracle. This user should have privileges to read all the metadata in Oracle.
- **`password`** *(string)*: Password to connect to Oracle.
- **`hostPort`** *(string)*: Host and port of the Oracle service.
- **`oracleConnectionType`** *(object)*: Connect with oracle by either passing service name or database schema name.
- **`instantClientDirectory`** *(string)*: This directory will be used to set the LD_LIBRARY_PATH env variable. It is required if you need to enable thick connection mode. By default, we bring instant client 19 and point to /instantclient. Default: `/instantclient`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`oracleType`** *(string)*: Service type. Must be one of: `['Oracle']`. Default: `Oracle`.
- **`oracleScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['oracle+cx_oracle']`. Default: `oracle+cx_oracle`.
- **`OracleDatabaseSchema`**
  - **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`OracleServiceName`**
  - **`oracleServiceName`** *(string)*: The Oracle Service name is the TNS alias that you give when you remotely connect to your database.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
