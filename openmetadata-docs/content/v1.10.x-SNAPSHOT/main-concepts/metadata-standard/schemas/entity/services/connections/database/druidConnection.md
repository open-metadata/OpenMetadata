---
title: druidConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/druidconnection
---

# DruidConnection

*Druid Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/druidType*. Default: `Druid`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/druidScheme*. Default: `druid`.
- **`username`** *(string)*: Username to connect to Druid. This user should have privileges to read all the metadata in Druid.
- **`password`** *(string)*: Password to connect to Druid.
- **`hostPort`** *(string)*: Host and port of the Druid service.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsViewLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsViewLineageExtraction*.
## Definitions

- **`druidType`** *(string)*: Service type. Must be one of: `['Druid']`. Default: `Druid`.
- **`druidScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['druid']`. Default: `druid`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
