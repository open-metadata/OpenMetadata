---
title: appExtension
slug: /main-concepts/metadata-standard/schemas/entity/applications/appextension
---

# AppExtension

*App Extension Object.*

## Properties

- **`appId`**: Unique identifier of this application. Refer to *../../type/basic.json#/definitions/uuid*.
- **`appName`**: Name of the application. Refer to *../../type/basic.json#/definitions/entityName*.
- **`timestamp`**: Start of the job status. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`extension`**: Refer to *#/definitions/extensionType*.
## Definitions

- **`extensionType`** *(string)*: Extension type. Must be one of: `['status', 'limits', 'custom']`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
