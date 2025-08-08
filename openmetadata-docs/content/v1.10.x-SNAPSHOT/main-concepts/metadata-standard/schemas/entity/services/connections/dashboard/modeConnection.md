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
- **`filterQueryParam`** *(string)*: Filter query parameter for some of the Mode API calls.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`modeType`** *(string)*: Mode service type. Must be one of: `['Mode']`. Default: `Mode`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
