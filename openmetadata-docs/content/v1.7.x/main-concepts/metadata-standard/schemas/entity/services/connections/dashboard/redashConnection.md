---
title: Redash Connection | OpenMetadata Redash Connection Setup
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/redashconnection
---

# RedashConnection

*Redash Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/redashType](#definitions/redashType)*. Default: `"Redash"`.
- **`username`** *(string)*: Username for Redash.
- **`hostPort`** *(string, format: uri)*: URL for the Redash instance. Default: `"http://localhost:5000"`.
- **`apiKey`** *(string, format: password)*: API key of the redash instance to access.
- **`redashVersion`** *(string)*: Version of the Redash instance. Default: `"10.0.0"`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`redashType`** *(string)*: Redash service type. Must be one of: `["Redash"]`. Default: `"Redash"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
