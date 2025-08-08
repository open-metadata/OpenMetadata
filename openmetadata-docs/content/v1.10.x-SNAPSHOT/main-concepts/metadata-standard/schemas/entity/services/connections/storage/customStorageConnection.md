---
title: customStorageConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/customstorageconnection
---

# CustomStorageConnection

*Custom Storage Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom storage service type. Refer to *#/definitions/customStorageType*. Default: `CustomStorage`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`containerFilterPattern`**: Regex to only fetch containers that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`customStorageType`** *(string)*: Custom storage service type. Must be one of: `['CustomStorage']`. Default: `CustomStorage`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
