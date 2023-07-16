---
title: domoPipelineConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/domopipelineconnection
---

# DomoPipelineConnection

*Domo Pipeline Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/DomoPipelineType](#definitions/DomoPipelineType)*. Default: `"DomoPipeline"`.
- **`clientId`** *(string)*: Client ID for DOMO.
- **`secretToken`** *(string)*: Secret token to connect to DOMO.
- **`accessToken`** *(string)*: Access token to connect to DOMO.
- **`apiHost`** *(string)*: API Host to connect to DOMO instance. Default: `"api.domo.com"`.
- **`sandboxDomain`** *(string)*: Connect to Sandbox Domain.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/DomoPipelineType"></a>**`DomoPipelineType`** *(string)*: Service type. Must be one of: `["DomoPipeline"]`. Default: `"DomoPipeline"`.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
