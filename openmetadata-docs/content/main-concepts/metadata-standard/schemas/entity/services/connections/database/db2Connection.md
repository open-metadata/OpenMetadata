---
title: db2Connection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/db2connection
---

# Db2Connection

*Db2 Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/db2Type*. Default: `Db2`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/db2Scheme*. Default: `db2+ibm_db`.
- **`username`** *(string)*: Username to connect to DB2. This user should have privileges to read all the metadata in DB2.
- **`password`** *(string)*: Password to connect to DB2.
- **`hostPort`** *(string)*: Host and port of the DB2 service.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`db2Type`** *(string)*: Service type. Must be one of: `['Db2']`. Default: `Db2`.
- **`db2Scheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['db2+ibm_db']`. Default: `db2+ibm_db`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
