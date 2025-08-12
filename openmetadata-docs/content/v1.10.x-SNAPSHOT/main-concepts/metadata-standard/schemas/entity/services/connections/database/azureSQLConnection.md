---
title: azureSQLConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/azuresqlconnection
---

# AzureSQLConnection

*Azure SQL Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/azureSQLType*. Default: `AzureSQL`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/azureSQLScheme*. Default: `mssql+pyodbc`.
- **`username`** *(string)*: Username to connect to AzureSQL. This user should have privileges to read the metadata.
- **`password`** *(string)*: Password to connect to AzureSQL.
- **`hostPort`** *(string)*: Host and port of the AzureSQL service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`driver`** *(string)*: SQLAlchemy driver for AzureSQL. Default: `ODBC Driver 18 for SQL Server`.
- **`authenticationMode`**: This parameter determines the mode of authentication for connecting to AzureSQL using ODBC. If 'Active Directory Password' is selected, you need to provide the password. If 'Active Directory Integrated' is selected, password is not required as it uses the logged-in user's credentials. This mode is useful for establishing secure and seamless connections with AzureSQL.
  - **`authentication`** *(string)*: Authentication from Connection String for AzureSQL. Must be one of: `['ActiveDirectoryIntegrated', 'ActiveDirectoryPassword']`.
  - **`encrypt`** *(boolean)*: Encrypt from Connection String for AzureSQL.
  - **`trustServerCertificate`** *(boolean)*: Trust Server Certificate from Connection String for AzureSQL.
  - **`connectionTimeout`** *(integer)*: Connection Timeout from Connection String for AzureSQL. Default: `30`.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Azuresql. You can use databaseFilterPattern on top of this. Default: `False`.
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
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
## Definitions

- **`azureSQLType`** *(string)*: Service type. Must be one of: `['AzureSQL']`. Default: `AzureSQL`.
- **`azureSQLScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['mssql+pyodbc']`. Default: `mssql+pyodbc`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
