---
title: Domodatabaseconnection | Official Documentation
description: Get started with domodatabaseconnection. Setup instructions, features, and configuration details inside.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/domodatabaseconnection
---

# DomoDatabaseConnection

*Domo Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/domoDatabaseType](#definitions/domoDatabaseType)*. Default: `"DomoDatabase"`.
- **`clientId`** *(string)*: Client ID for DOMO.
- **`secretToken`** *(string, format: password)*: Secret Token to connect DOMO.
- **`accessToken`** *(string)*: Access token to connect to DOMO.
- **`apiHost`** *(string, format: string)*: API Host to connect to DOMO instance. Default: `"api.domo.com"`.
- **`instanceDomain`** *(string, format: uri)*: URL of your Domo instance, e.g., https://openmetadata.domo.com.
- **`databaseName`** *(string)*: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`domoDatabaseType`** *(string)*:  service type. Must be one of: `["DomoDatabase"]`. Default: `"DomoDatabase"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
