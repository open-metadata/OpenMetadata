---
title: synapseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/synapseconnection
---

# SynapseConnection

*Synapse Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/synapseType*. Default: `Synapse`.
- **`scheme`**: SQLAlchemy driver scheme options. Refer to *#/definitions/synapseScheme*. Default: `mssql+pyodbc`.
- **`username`** *(string)*: Username to connect to Azure Synapse. This user should have privileges to read all the metadata in Azure Synapse.
- **`password`** *(string)*: Password to connect to Azure Synapse.
- **`hostPort`** *(string)*: Host and port of the Azure Synapse service.
- **`database`** *(string)*: Database of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, OpenMetadata Ingestion attempts to scan all the databases.
- **`driver`** *(string)*: ODBC driver version in case of pyodbc connection. Default: `ODBC Driver 18 for SQL Server`.
- **`clientId`** *(string)*: Azure Application (client) ID for service principal authentication.
- **`clientSecret`** *(string)*: Azure Application client secret for service principal authentication.
- **`tenantId`** *(string)*: Azure Directory (tenant) ID for service principal authentication.
- **`authenticationMode`**: This parameter determines the mode of authentication for connecting to Azure Synapse using ODBC. If 'Active Directory Password' is selected, you need to provide the password. If 'Active Directory Integrated' is selected, password is not required as it uses the logged-in user's credentials. If 'Active Directory Service Principal' is selected, you need to provide clientId, clientSecret and tenantId. This mode is useful for establishing secure and seamless connections with Azure Synapse.
  - **`authentication`** *(string)*: Authentication from Connection String for Azure Synapse. Must be one of: `['ActiveDirectoryIntegrated', 'ActiveDirectoryPassword', 'ActiveDirectoryServicePrincipal']`.
  - **`encrypt`** *(boolean)*: Encrypt from Connection String for Azure Synapse.
  - **`trustServerCertificate`** *(boolean)*: Trust Server Certificate from Connection String for Azure Synapse.
  - **`connectionTimeout`** *(integer)*: Connection Timeout from Connection String for Azure Synapse. Default: `30`.
- **`ingestAllDatabases`** *(boolean)*: Ingest data from all databases in Azure Synapse. You can use databaseFilterPattern on top of this. Default: `False`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsDBTExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsDBTExtraction*.
- **`supportsProfiler`**: Refer to *../connectionBasicType.json#/definitions/supportsProfiler*.
- **`supportsDatabase`**: Refer to *../connectionBasicType.json#/definitions/supportsDatabase*.
- **`supportsUsageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsUsageExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
- **`sampleDataStorageConfig`**: Refer to *../connectionBasicType.json#/definitions/sampleDataStorageConfig*.
- **`supportsQueryComment`**: Refer to *../connectionBasicType.json#/definitions/supportsQueryComment*.
## Definitions

- **`synapseType`** *(string)*: Service type. Must be one of: `['Synapse']`. Default: `Synapse`.
- **`synapseScheme`** *(string)*: SQLAlchemy driver scheme options. Must be one of: `['mssql+pyodbc']`. Default: `mssql+pyodbc`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
