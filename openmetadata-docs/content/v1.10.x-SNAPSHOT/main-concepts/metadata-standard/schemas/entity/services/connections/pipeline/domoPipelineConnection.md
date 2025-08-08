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
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`DomoPipelineType`** *(string)*: Service type. Must be one of: `['DomoPipeline']`. Default: `DomoPipeline`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
