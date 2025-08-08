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
- **`licenseFileName`** *(string)*: License file name to connect to DB2.
- **`license`** *(string)*: License to connect to DB2.
- **`clidriverVersion`** *(string)*: CLI Driver version to connect to DB2. If not provided, the latest version will be used.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsViewLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsViewLineageExtraction*.
## Definitions

- **`db2Type`** *(string)*: Service type. Must be one of: `['Db2']`. Default: `Db2`.
- **`db2Scheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['db2+ibm_db', 'ibmi']`. Default: `db2+ibm_db`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
