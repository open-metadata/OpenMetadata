---
title: indexingError | OpenMetadata Indexing Error
slug: /main-concepts/metadata-standard/schemas/system/indexingerror
---

# IndexingAppError

*This schema defines Event Publisher Job Error Schema.*

## Properties

- **`errorSource`**: Refer to *[#/definitions/errorSource](#definitions/errorSource)*.
- **`lastFailedCursor`** *(string)*
- **`message`** *(string)*
- **`failedEntities`** *(array)*
  - **Items**: Refer to *[./entityError.json](#entityError.json)*.
- **`reason`** *(string)*
- **`stackTrace`** *(string)*
- **`submittedCount`** *(integer)*
- **`successCount`** *(integer)*
- **`failedCount`** *(integer)*
## Definitions

- **`errorSource`** *(string)*: Must be one of: `["Job", "Reader", "Processor", "Sink"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
