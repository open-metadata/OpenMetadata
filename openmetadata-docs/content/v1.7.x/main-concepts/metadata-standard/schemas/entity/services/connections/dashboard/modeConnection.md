---
title: Mode Connection | OpenMetadata Mode Dashboard Connection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/modeconnection
---

# ModeConnection

*Mode Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/modeType](#definitions/modeType)*. Default: `"Mode"`.
- **`hostPort`** *(string, format: uri)*: URL for the mode instance. Default: `"https://app.mode.com"`.
- **`accessToken`** *(string)*: Access Token for Mode Dashboard.
- **`accessTokenPassword`** *(string, format: password)*: Access Token Password for Mode Dashboard.
- **`workspaceName`** *(string)*: Mode Workspace Name.
- **`filterQueryParam`** *(string)*: Filter query parameter for some of the Mode API calls.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`modeType`** *(string)*: Mode service type. Must be one of: `["Mode"]`. Default: `"Mode"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
