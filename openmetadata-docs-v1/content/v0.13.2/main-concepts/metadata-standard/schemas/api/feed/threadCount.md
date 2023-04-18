---
title: threadCount
slug: /main-concepts/metadata-standard/schemas/api/feed/threadcount
---

# Count of threads related to an entity

*This schema defines the type for reporting the count of threads related to an entity.*

## Properties

- **`totalCount`** *(integer)*: Total count of all the threads. Minimum: `0`.
- **`counts`** *(array)*: .
  - **Items**: Refer to *#/definitions/entityLinkThreadCount*.
## Definitions

- **`entityLinkThreadCount`** *(object)*: Type used to return thread count per entity link. Cannot contain additional properties.
  - **`count`** *(integer)*: Count of threads for the given entity link. Minimum: `0`.
  - **`entityLink`**: Refer to *../../type/basic.json#/definitions/entityLink*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
