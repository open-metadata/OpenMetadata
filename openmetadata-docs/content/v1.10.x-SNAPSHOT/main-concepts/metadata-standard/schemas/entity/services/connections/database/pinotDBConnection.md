---
title: pinotDBConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/pinotdbconnection
---

# PinotDBConnection

*PinotDB Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/pinotDBType*. Default: `PinotDB`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/pinotDBScheme*. Default: `pinot`.
- **`username`** *(string)*: username to connect to the PinotDB. This user should have privileges to read all the metadata in PinotDB.
- **`password`** *(string)*: password to connect to the PinotDB.
- **`hostPort`** *(string)*: Host and port of the PinotDB Broker service.
- **`pinotControllerHost`** *(string)*: Pinot Controller Host and Port of the data source.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsViewLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsViewLineageExtraction*.
## Definitions

- **`pinotDBType`** *(string)*: Service type. Must be one of: `['PinotDB']`. Default: `PinotDB`.
- **`pinotDBScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['pinot', 'pinot+http', 'pinot+https']`. Default: `pinot`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
