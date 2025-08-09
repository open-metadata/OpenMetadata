---
title: verticaConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/verticaconnection
---

# VerticaConnection

*Vertica Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/verticaType*. Default: `Vertica`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/verticaScheme*. Default: `vertica+vertica_python`.
- **`username`** *(string)*: Username to connect to Vertica. This user should have privileges to read all the metadata in Vertica.
- **`password`** *(string)*: Password to connect to Vertica.
- **`hostPort`** *(string)*: Host and port of the Vertica service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
## Definitions

- **`verticaType`** *(string)*: Service type. Must be one of: `['Vertica']`. Default: `Vertica`.
- **`verticaScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['vertica+vertica_python']`. Default: `vertica+vertica_python`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
