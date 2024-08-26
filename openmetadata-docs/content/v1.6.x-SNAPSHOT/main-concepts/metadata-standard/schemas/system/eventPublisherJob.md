---
title: eventPublisherJob
slug: /main-concepts/metadata-standard/schemas/system/eventpublisherjob
---

# EventPublisherResult

*This schema defines Event Publisher Job.*

## Properties

- **`name`** *(string)*: Name of the result.
- **`timestamp`**: Refer to *../type/basic.json#/definitions/timestamp*.
- **`status`** *(string)*: This schema publisher run job status. Must be one of: `['STARTED', 'RUNNING', 'COMPLETED', 'FAILED', 'ACTIVE', 'ACTIVE_WITH_ERROR', 'STOPPED']`.
- **`failure`** *(object)*: List of Failures in the Job. Cannot contain additional properties.
  - **`sourceError`** *(object)*: Refer to *#/definitions/failureDetails*. Default: `None`.
  - **`processorError`** *(object)*: Refer to *#/definitions/failureDetails*. Default: `None`.
  - **`sinkError`** *(object)*: Refer to *#/definitions/failureDetails*. Default: `None`.
  - **`jobError`** *(object)*: Refer to *#/definitions/failureDetails*. Default: `None`.
- **`stats`**: Refer to *#/definitions/stats*.
- **`entities`** *(array)*: List of Entities to Reindex.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: This schema publisher run modes.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10).
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage*.
- **`afterCursor`** *(string)*: Provide After in case of failure to start reindexing after the issue is solved.
## Definitions

- **`failureDetails`** *(object)*: Failure details are set only when `status` is not `success`. Cannot contain additional properties.
  - **`context`** *(string)*: Additional Context for Failure.
  - **`lastFailedAt`**: Last non-successful callback time in UNIX UTC epoch time in milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
  - **`lastFailedReason`** *(string)*: Last non-successful activity response reason received during callback.
- **`stepStats`** *(object)*: Stats for Different Steps Reader, Processor, Writer. Cannot contain additional properties.
  - **`totalRecords`** *(integer)*: Count of Total Failed Records. Default: `0`.
  - **`processedRecords`** *(integer)*: Records that are processed in. Default: `0`.
  - **`successRecords`** *(integer)*: Count of Total Successfully Records. Default: `0`.
  - **`failedRecords`** *(integer)*: Count of Total Failed Records. Default: `0`.
- **`stats`** *(object)*: Cannot contain additional properties.
  - **`sourceStats`**: Refer to *#/definitions/stepStats*.
  - **`processorStats`**: Refer to *#/definitions/stepStats*.
  - **`sinkStats`**: Refer to *#/definitions/stepStats*.
  - **`jobStats`**: Refer to *#/definitions/stepStats*.
- **`runMode`** *(string)*: This schema publisher run modes. Must be one of: `['stream', 'batch']`.
- **`publisherType`** *(string)*: This schema event Publisher Types. Must be one of: `['elasticSearch', 'kafka']`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
