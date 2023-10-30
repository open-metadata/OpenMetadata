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
- **`database`** *(string)*: Database of the data source.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`db2Type`** *(string)*: Service type. Must be one of: `['Db2']`. Default: `Db2`.
- **`db2Scheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['db2+ibm_db']`. Default: `db2+ibm_db`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
