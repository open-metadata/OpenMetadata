---
title: domoDatabaseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/domodatabaseconnection
---

# DomoDatabaseConnection

*Domo Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/domoDatabaseType](#definitions/domoDatabaseType)*. Default: `"DomoDatabase"`.
- **`clientId`** *(string)*: Client ID for DOMO.
- **`secretToken`** *(string)*: Secret Token to connect DOMO.
- **`accessToken`** *(string)*: Access token to connect to DOMO.
- **`apiHost`** *(string)*: API Host to connect to DOMO instance. Default: `"api.domo.com"`.
- **`sandboxDomain`** *(string)*: Connect to Sandbox Domain.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/domoDatabaseType"></a>**`domoDatabaseType`** *(string)*:  service type. Must be one of: `["DomoDatabase"]`. Default: `"DomoDatabase"`.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
