---
title: hiveConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/hiveconnection
---

# HiveConnection

*Hive SQL Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/hiveType*. Default: `Hive`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/hiveScheme*. Default: `hive`.
- **`username`** *(string)*: Username to connect to Hive. This user should have privileges to read all the metadata in Hive.
- **`password`** *(string)*: Password to connect to Hive.
- **`hostPort`** *(string)*: Host and port of the Hive service.
- **`databaseSchema`** *(string)*: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **`authOptions`** *(string)*: Authentication options to pass to Hive connector. These options are based on SQLAlchemy.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
## Definitions

- **`hiveType`** *(string)*: Service type. Must be one of: `['Hive']`. Default: `Hive`.
- **`hiveScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['hive']`. Default: `hive`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
