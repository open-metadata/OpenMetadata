---
title: App Extension | OpenMetadata App Extensions
description: Connect Appextension to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/entity/applications/appextension
---

# AppExtension

*App Extension Object.*

## Properties

- **`appId`**: Unique identifier of this application. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`appName`**: Name of the application. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`timestamp`**: Start of the job status. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`extension`**: Refer to *[#/definitions/extensionType](#definitions/extensionType)*.
## Definitions

- **`extensionType`** *(string)*: Extension type. Must be one of: `["status", "limits", "custom"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
