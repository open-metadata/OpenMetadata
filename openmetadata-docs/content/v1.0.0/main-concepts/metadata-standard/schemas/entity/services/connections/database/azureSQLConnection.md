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
- **`driver`** *(string)*: SQLAlchemy driver for AzureSQL. Default: `ODBC Driver 17 for SQL Server`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
## Definitions

- **`azureSQLType`** *(string)*: Service type. Must be one of: `['AzureSQL']`. Default: `AzureSQL`.
- **`azureSQLScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['mssql+pyodbc']`. Default: `mssql+pyodbc`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
