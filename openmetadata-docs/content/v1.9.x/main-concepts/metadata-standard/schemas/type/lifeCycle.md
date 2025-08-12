---
title: Life Cycle | OpenMetadata Life Cycle Details
description: Lifecycle schema defines the state transitions and status tracking for metadata objects.
slug: /main-concepts/metadata-standard/schemas/type/lifecycle
---

# Life Cycle

*This schema defines Life Cycle Properties.*

## Properties

- **`created`**: Access Details about created aspect of the data asset. Refer to *[#/definitions/accessDetails](#definitions/accessDetails)*.
- **`updated`**: Access Details about updated aspect of the data asset. Refer to *[#/definitions/accessDetails](#definitions/accessDetails)*.
- **`accessed`**: Access Details about accessed aspect of the data asset. Refer to *[#/definitions/accessDetails](#definitions/accessDetails)*.
## Definitions

- **`accessDetails`** *(object)*: Access details of an entity . Cannot contain additional properties.
  - **`timestamp`**: Timestamp of data asset accessed for creation, update, read. Refer to *[basic.json#/definitions/timestamp](#sic.json#/definitions/timestamp)*. Default: `null`.
  - **`accessedBy`**: User, Pipeline, Query that created,updated or accessed the data asset. Refer to *[entityReference.json](#tityReference.json)*. Default: `null`.
  - **`accessedByAProcess`** *(string)*: Any process that accessed the data asset that is not captured in OpenMetadata. Default: `null`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
