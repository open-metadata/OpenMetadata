---
title: MSSQL Connection | OpenMetadata Microsoft SQL Server Connection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/mssqlconnection
---

# MssqlConnection

*Mssql Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/mssqlType](#definitions/mssqlType)*. Default: `"Mssql"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/mssqlScheme](#definitions/mssqlScheme)*. Default: `"mssql+pytds"`.
- **`username`** *(string)*: Username to connect to MSSQL. This user should have privileges to read all the metadata in MsSQL.
- **`password`** *(string, format: password)*: Password to connect to MSSQL.
- **`hostPort`** *(string)*: Host and port of the MSSQL service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`driver`** *(string)*: ODBC driver version in case of pyodbc connection. Default: `"ODBC Driver 18 for SQL Server"`.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Mssql. You can use databaseFilterPattern on top of this. Default: `false`.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
- **`supportsDBTExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsDBTExtraction](#/connectionBasicType.json#/definitions/supportsDBTExtraction)*.
- **`supportsProfiler`**: Refer to *[../connectionBasicType.json#/definitions/supportsProfiler](#/connectionBasicType.json#/definitions/supportsProfiler)*.
- **`supportsDatabase`**: Refer to *[../connectionBasicType.json#/definitions/supportsDatabase](#/connectionBasicType.json#/definitions/supportsDatabase)*.
- **`supportsUsageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsUsageExtraction](#/connectionBasicType.json#/definitions/supportsUsageExtraction)*.
- **`supportsLineageExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsLineageExtraction](#/connectionBasicType.json#/definitions/supportsLineageExtraction)*.
- **`sampleDataStorageConfig`**: Refer to *[../connectionBasicType.json#/definitions/sampleDataStorageConfig](#/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
- **`supportsQueryComment`**: Refer to *[../connectionBasicType.json#/definitions/supportsQueryComment](#/connectionBasicType.json#/definitions/supportsQueryComment)*.
- **`supportsDataDiff`**: Refer to *[../connectionBasicType.json#/definitions/supportsDataDiff](#/connectionBasicType.json#/definitions/supportsDataDiff)*.
## Definitions

- **`mssqlType`** *(string)*: Service type. Must be one of: `["Mssql"]`. Default: `"Mssql"`.
- **`mssqlScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["mssql+pyodbc", "mssql+pytds", "mssql+pymssql"]`. Default: `"mssql+pytds"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
