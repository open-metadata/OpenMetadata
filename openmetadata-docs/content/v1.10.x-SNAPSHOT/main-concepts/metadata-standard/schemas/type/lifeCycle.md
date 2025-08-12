---
title: lifeCycle
slug: /main-concepts/metadata-standard/schemas/type/lifecycle
---

# Life Cycle

*This schema defines Life Cycle Properties.*

## Properties

- **`created`**: Access Details about created aspect of the data asset. Refer to *#/definitions/accessDetails*.
- **`updated`**: Access Details about updated aspect of the data asset. Refer to *#/definitions/accessDetails*.
- **`accessed`**: Access Details about accessed aspect of the data asset. Refer to *#/definitions/accessDetails*.
## Definitions

- **`accessDetails`** *(object)*: Access details of an entity . Cannot contain additional properties.
  - **`timestamp`**: Timestamp of data asset accessed for creation, update, read. Refer to *basic.json#/definitions/timestamp*. Default: `None`.
  - **`accessedBy`**: User, Pipeline, Query that created,updated or accessed the data asset. Refer to *entityReference.json*. Default: `None`.
  - **`accessedByAProcess`** *(string)*: Any process that accessed the data asset that is not captured in OpenMetadata. Default: `None`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
