---
title: customStorageConnection | Official Documentation
description: Set up configurations for custom storage integrations using this schema to ingest and manage metadata from external storage.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/storage/customstorageconnection
---

# CustomStorageConnection

*Custom Storage Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom storage service type. Refer to *[#/definitions/customStorageType](#definitions/customStorageType)*. Default: `"CustomStorage"`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
## Definitions

- **`customStorageType`** *(string)*: Custom storage service type. Must be one of: `["CustomStorage"]`. Default: `"CustomStorage"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
