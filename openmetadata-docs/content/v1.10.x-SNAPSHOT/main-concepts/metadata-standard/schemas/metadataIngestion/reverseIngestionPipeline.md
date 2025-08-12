---
title: reverseIngestionPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/reverseingestionpipeline
---

# reverseIngestionPipeline

*Apply a set of operations on a service*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/reverseIngestionType*. Default: `ReverseIngestion`.
- **`service`**: Service to be modified. Refer to *../type/entityReference.json*.
- **`operations`** *(array)*: List of operations to be performed on the service.
  - **Items**: Refer to *#/definitions/operation*.
- **`ingestionRunner`** *(string)*: Optional value of the ingestion runner name responsible for running the workflow.
## Definitions

- **`reverseIngestionType`** *(string)*: Reverse Ingestion Config Pipeline type. Must be one of: `['ReverseIngestion']`. Default: `ReverseIngestion`.
- **`operation`** *(object)*: Operation to be performed on the entity. Cannot contain additional properties.
  - **`id`**: The id of the operation. Refer to *../type/basic.json#/definitions/uuid*.
  - **`entityLink`**: Entity to be modified. Refer to *../type/basic.json#/definitions/entityLink*.
  - **`type`** *(string)*: Type of operation to perform. Must be one of: `['UPDATE_DESCRIPTION', 'UPDATE_OWNER', 'UPDATE_TAGS']`.
  - **`SQLTemplate`** *(string)*: Templated SQL command to be used for the operation. Context parameters will be populated based on the event type.
  - **`parameters`**: The configuration for the operation to be applied.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
