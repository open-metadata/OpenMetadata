---
title: sapErpConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/saperpconnection
---

# SapErpConnection

*Sap ERP Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/sapErpType*. Default: `SapErp`.
- **`hostPort`** *(string)*: Host and Port of the SAP ERP instance.
- **`apiKey`** *(string)*: API key to authenticate with the SAP ERP APIs.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`databaseSchema`** *(string)*: Optional name to give to the schema in OpenMetadata. If left blank, we will use default as the schema name.
- **`paginationLimit`** *(integer)*: Pagination limit used while querying the SAP ERP API for fetching the entities. Default: `10`.
- **`verifySSL`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL*. Default: `no-ssl`.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`sapErpType`** *(string)*: Service type. Must be one of: `['SapErp']`. Default: `SapErp`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
