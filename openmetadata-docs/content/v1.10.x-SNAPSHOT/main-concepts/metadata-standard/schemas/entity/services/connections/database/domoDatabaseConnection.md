---
title: domoDatabaseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/domodatabaseconnection
---

# DomoDatabaseConnection

*Domo Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/domoDatabaseType*. Default: `DomoDatabase`.
- **`clientId`** *(string)*: Client ID for DOMO.
- **`secretToken`** *(string)*: Secret Token to connect DOMO.
- **`accessToken`** *(string)*: Access token to connect to DOMO.
- **`apiHost`** *(string)*: API Host to connect to DOMO instance. Default: `api.domo.com`.
- **`instanceDomain`** *(string)*: URL of your Domo instance, e.g., https://openmetadata.domo.com.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`schemaFilterPattern`**: Regex to only include/exclude schemas that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex to only include/exclude tables that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only include/exclude databases that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`domoDatabaseType`** *(string)*:  service type. Must be one of: `['DomoDatabase']`. Default: `DomoDatabase`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
