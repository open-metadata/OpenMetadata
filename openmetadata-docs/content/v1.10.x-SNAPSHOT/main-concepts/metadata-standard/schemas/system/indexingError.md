---
title: indexingError
slug: /main-concepts/metadata-standard/schemas/system/indexingerror
---

# IndexingAppError

*This schema defines Event Publisher Job Error Schema. Additional properties exist for backward compatibility. Don't use it.*

## Properties

- **`errorSource`**: Refer to *#/definitions/errorSource*.
- **`lastFailedCursor`** *(string)*
- **`message`** *(string)*
- **`failedEntities`** *(array)*
  - **Items**: Refer to *./entityError.json*.
- **`reason`** *(string)*
- **`stackTrace`** *(string)*
- **`submittedCount`** *(integer)*
- **`successCount`** *(integer)*
- **`failedCount`** *(integer)*
## Definitions

- **`errorSource`** *(string)*: Must be one of: `['Job', 'Reader', 'Processor', 'Sink']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
