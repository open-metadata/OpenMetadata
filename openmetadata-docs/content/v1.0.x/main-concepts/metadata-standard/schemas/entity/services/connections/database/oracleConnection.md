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
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`oracleServiceName`** *(string)*: Oracle Service Name to be passed. Note: either Database or Oracle service name can be sent, not both.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`oracleType`** *(string)*: Service type. Must be one of: `['Oracle']`. Default: `Oracle`.
- **`oracleScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['oracle+cx_oracle']`. Default: `oracle+cx_oracle`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
