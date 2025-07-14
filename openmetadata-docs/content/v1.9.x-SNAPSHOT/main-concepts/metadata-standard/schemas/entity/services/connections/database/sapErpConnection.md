---
title: SAP ERP Connection | OpenMetadata SAP ERP
description: Get started with saperpconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/saperpconnection
---

# SapErpConnection

*Sap ERP Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/sapErpType](#definitions/sapErpType)*. Default: `"SapErp"`.
- **`hostPort`** *(string, format: uri)*: Host and Port of the SAP ERP instance.
- **`apiKey`** *(string, format: password)*: API key to authenticate with the SAP ERP APIs.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`databaseSchema`** *(string)*: Optional name to give to the schema in OpenMetadata. If left blank, we will use default as the schema name.
- **`paginationLimit`** *(integer)*: Pagination limit used while querying the SAP ERP API for fetching the entities. Default: `10`.
- **`verifySSL`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL](#/../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL)*. Default: `"no-ssl"`.
- **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
- **`connectionArguments`**: Refer to *[../connectionBasicType.json#/definitions/connectionArguments](#/connectionBasicType.json#/definitions/connectionArguments)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`sapErpType`** *(string)*: Service type. Must be one of: `["SapErp"]`. Default: `"SapErp"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
