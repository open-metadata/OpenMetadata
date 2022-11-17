---
title: eventPublisherJob
slug: /main-concepts/metadata-standard/schemas/settings/eventpublisherjob
---

# EventPublisherResult

*This schema defines Event Publisher Run Result.*

## Properties

- **`name`** *(string)*: Name of the result.
- **`startedBy`** *(string)*: Job started by.
- **`publisherType`**: Refer to *#/definitions/publisherType*.
- **`runMode`**: Refer to *#/definitions/runMode*.
- **`timestamp`**: Refer to *../type/basic.json#/definitions/timestamp*.
- **`startTime`**: Refer to *../type/basic.json#/definitions/timestamp*.
- **`endTime`**: Refer to *../type/basic.json#/definitions/timestamp*.
- **`status`** *(string)*: This schema publisher run job status. Must be one of: `['STARTING', 'ACTIVE', 'RETRY', 'ACTIVEWITHERROR', 'IDLE', 'COMPLETED']`.
- **`failureDetails`** *(object)*: Failure details are set only when `status` is not `success`. Cannot contain additional properties.
  - **`context`** *(string)*: Additional Context for Failure.
  - **`lastFailedAt`**: Last non-successful callback time in UNIX UTC epoch time in milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
  - **`lastFailedReason`** *(string)*: Last non-successful activity response reason received during callback.
- **`stats`**: Refer to *#/definitions/stats*.
- **`entities`** *(array)*: List of Entities to Reindex.
  - **Items** *(string)*
## Definitions

- **`stats`** *(object)*: Cannot contain additional properties.
  - **`success`** *(integer)*: Count of Success Record. Default: `0`.
  - **`failed`** *(integer)*: Count of Failed Records. Default: `0`.
  - **`total`** *(integer)*: Count of Failed Records. Default: `0`.
- **`runMode`** *(string)*: This schema publisher run modes. Must be one of: `['stream', 'batch']`.
- **`publisherType`** *(string)*: This schema event Publisher Types. Must be one of: `['elasticSearch', 'kafka']`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
