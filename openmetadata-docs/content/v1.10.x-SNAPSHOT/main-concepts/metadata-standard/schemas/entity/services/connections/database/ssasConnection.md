---
title: ssasConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/database/ssasconnection
---

# SSASConnection

*SSAS Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/SSASType*. Default: `SSAS`.
- **`httpConnection`** *(string)*: HTTP Link for SSAS ACCESS.
- **`username`** *(string)*: Username.
- **`password`** *(string)*: Password.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`supportsLineageExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsLineageExtraction*.
## Definitions

- **`SSASType`** *(string)*: Service type. Must be one of: `['SSAS']`. Default: `SSAS`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
