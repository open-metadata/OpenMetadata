---
title: sqliteConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/sqliteconnection
---

# SQLiteConnection

*SQLite Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/SQLiteType*. Default: `SQLite`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/SQLiteScheme*. Default: `sqlite+pysqlite`.
- **`username`** *(string)*: Username to connect to SQLite. Blank for in-memory database.
- **`password`** *(string)*: Password to connect to SQLite. Blank for in-memory database.
- **`hostPort`** *(string)*: Host and port of the SQLite service. Blank for in-memory database.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`databaseMode`** *(string)*: How to run the SQLite database. :memory: by default. Default: `:memory:`.
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

- **`SQLiteType`** *(string)*: Service type. Must be one of: `['SQLite']`. Default: `SQLite`.
- **`SQLiteScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['sqlite+pysqlite']`. Default: `sqlite+pysqlite`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
