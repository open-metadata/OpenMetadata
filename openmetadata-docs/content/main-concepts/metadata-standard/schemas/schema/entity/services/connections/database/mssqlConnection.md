---
title: mssqlConnection
slug: /main-concepts/metadata-standard/schemas/schema/entity/services/connections/database
---

# MssqlConnection

*Mssql Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/mssqlType*. Default: `Mssql`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/mssqlScheme*. Default: `mssql+pytds`.
- **`username`** *(string)*: Username to connect to MSSQL. This user should have privileges to read all the metadata in MsSQL.
- **`password`** *(string)*: Password to connect to MSSQL.
- **`hostPort`** *(string)*: Host and port of the MSSQL service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`uriString`** *(string)*: Connection URI In case of pyodbc.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
## Definitions

- **`mssqlType`** *(string)*: Service type. Must be one of: `['Mssql']`. Default: `Mssql`.
- **`mssqlScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['mssql+pyodbc', 'mssql+pytds', 'mssql+pymssql']`. Default: `mssql+pytds`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
