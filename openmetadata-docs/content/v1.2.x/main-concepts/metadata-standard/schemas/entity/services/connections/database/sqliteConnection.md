---
title: sqliteConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/sqliteconnection
---

# SQLiteConnection

*SQLite Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/SQLiteType](#definitions/SQLiteType)*. Default: `"SQLite"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/SQLiteScheme](#definitions/SQLiteScheme)*. Default: `"sqlite+pysqlite"`.
- **`username`** *(string)*: Username to connect to SQLite. Blank for in-memory database.
- **`password`** *(string, format: password)*: Password to connect to SQLite. Blank for in-memory database.
- **`hostPort`** *(string)*: Host and port of the SQLite service. Blank for in-memory database.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`databaseMode`** *(string)*: How to run the SQLite database. :memory: by default. Default: `":memory:"`.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
## Definitions

- <a id="definitions/SQLiteType"></a>**`SQLiteType`** *(string)*: Service type. Must be one of: `["SQLite"]`. Default: `"SQLite"`.
- <a id="definitions/SQLiteScheme"></a>**`SQLiteScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["sqlite+pysqlite"]`. Default: `"sqlite+pysqlite"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
