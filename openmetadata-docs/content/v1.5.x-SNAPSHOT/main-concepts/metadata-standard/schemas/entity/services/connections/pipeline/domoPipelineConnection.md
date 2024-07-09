---
title: domoPipelineConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/domopipelineconnection
---

# DomoPipelineConnection

*Domo Pipeline Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/DomoPipelineType*. Default: `DomoPipeline`.
- **`clientId`** *(string)*: Client ID for DOMO.
- **`secretToken`** *(string)*: Secret token to connect to DOMO.
- **`accessToken`** *(string)*: Access token to connect to DOMO.
- **`apiHost`** *(string)*: API Host to connect to DOMO instance. Default: `api.domo.com`.
- **`instanceDomain`** *(string)*: URL of your Domo instance, e.g., https://openmetadata.domo.com.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`DomoPipelineType`** *(string)*: Service type. Must be one of: `['DomoPipeline']`. Default: `DomoPipeline`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
