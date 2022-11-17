---
title: domodatabaseConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/domodatabaseconnection
---

# DomoDatabaseConnection

*Domo Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/domodatabaseType*. Default: `DomoDatabase`.
- **`clientId`** *(string)*: Client ID for DOMO.
- **`secretToken`** *(string)*: Secret Token to connect DOMO.
- **`accessToken`** *(string)*: Access to connecto to DOMO.
- **`apiHost`** *(string)*: API Host to connect to DOMO instance. Default: `api.domo.com`.
- **`sandboxDomain`** *(string)*: Connect to Sandbox Domain.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`domodatabaseType`** *(string)*:  service type. Must be one of: `['DomoDatabase']`. Default: `DomoDatabase`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
