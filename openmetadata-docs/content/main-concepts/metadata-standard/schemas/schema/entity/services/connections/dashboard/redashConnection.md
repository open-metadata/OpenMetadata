---
title: redashConnection
slug: /main-concepts/metadata-standard/schemas/schema/entity/services/connections/dashboard
---

# RedashConnection

*Redash Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/redashType*. Default: `Redash`.
- **`username`** *(string)*: Username for Redash.
- **`hostPort`** *(string)*: URL for the Redash instance. Default: `http://localhost:5000`.
- **`apiKey`** *(string)*: API key of the redash instance to access.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`redashType`** *(string)*: Redash service type. Must be one of: `['Redash']`. Default: `Redash`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
