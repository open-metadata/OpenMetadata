---
title: prestoConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/prestoconnection
---

# PrestoConnection

*Presto Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/prestoType*. Default: `Presto`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/prestoScheme*. Default: `presto`.
- **`username`** *(string)*: Username to connect to Presto. This user should have privileges to read all the metadata in Postgres.
- **`password`** *(string)*: Password to connect to Presto.
- **`hostPort`** *(string)*: Host and port of the Presto service.
- **`databaseSchema`** *(string)*: Database Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
- **`catalog`** *(string)*: Presto catalog.
- **`protocol`** *(string)*: Protocol ( Connection Argument ) to connect to Presto.
- **`verify`** *(string)*: Verify ( Connection Argument for SSL ) to connect to Presto.
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
## Definitions

- **`prestoType`** *(string)*: Service type. Must be one of: `['Presto']`. Default: `Presto`.
- **`prestoScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['presto']`. Default: `presto`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
