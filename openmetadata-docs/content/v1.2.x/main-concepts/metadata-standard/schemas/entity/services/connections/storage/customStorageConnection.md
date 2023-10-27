---
title: customStorageConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/customstorageconnection
---

# CustomStorageConnection

*Custom Storage Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom storage service type. Refer to *[#/definitions/customStorageType](#definitions/customStorageType)*. Default: `"CustomStorage"`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
## Definitions

- <a id="definitions/customStorageType"></a>**`customStorageType`** *(string)*: Custom storage service type. Must be one of: `["CustomStorage"]`. Default: `"CustomStorage"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
