---
title: Synapse Connection | OpenMetadata Synapse
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/synapseconnection
---

# SynapseConnection

*Synapse Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/synapseType](#definitions/synapseType)*. Default: `"Synapse"`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *[#/definitions/synapseScheme](#definitions/synapseScheme)*. Default: `"mssql+pyodbc"`.
- **`username`** *(string)*: Username to connect to Azure Synapse. This user should have privileges to read all the metadata in Azure Synapse.
- **`password`** *(string, format: password)*: Password to connect to Azure Synapse.
- **`hostPort`** *(string)*: Host and port of the Azure Synapse service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`driver`** *(string)*: ODBC driver version in case of pyodbc connection. Default: `"ODBC Driver 18 for SQL Server"`.
- **`authenticationMode`**: This parameter determines the mode of authentication for connecting to Azure Synapse using ODBC. If 'Active Directory Password' is selected, you need to provide the password. If 'Active Directory Integrated' is selected, password is not required as it uses the logged-in user's credentials. This mode is useful for establishing secure and seamless connections with Azure Synapse.
  - **`authentication`** *(string)*: Authentication from Connection String for Azure Synapse. Must be one of: `["ActiveDirectoryIntegrated", "ActiveDirectoryPassword"]`.
  - **`encrypt`** *(boolean)*: Encrypt from Connection String for Azure Synapse.
  - **`trustServerCertificate`** *(boolean)*: Trust Server Certificate from Connection String for Azure Synapse.
  - **`connectionTimeout`** *(integer)*: Connection Timeout from Connection String for Azure Synapse. Default: `30`.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Azure Synapse. You can use databaseFilterPattern on top of this. Default: `false`.
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
## Definitions

- **`synapseType`** *(string)*: Service type. Must be one of: `["Synapse"]`. Default: `"Synapse"`.
- **`synapseScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `["mssql+pyodbc"]`. Default: `"mssql+pyodbc"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
