---
title: modeConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/modeconnection
---

# ModeConnection

*Mode Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/modeType*. Default: `Mode`.
- **`hostPort`** *(string)*: URL for the mode instance. Default: `https://app.mode.com`.
- **`accessToken`** *(string)*: Access Token for Mode Dashboard.
- **`accessTokenPassword`** *(string)*: Access Token Password for Mode Dashboard.
- **`workspaceName`** *(string)*: Mode Workspace Name.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`modeType`** *(string)*: Mode service type. Must be one of: `['Mode']`. Default: `Mode`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
