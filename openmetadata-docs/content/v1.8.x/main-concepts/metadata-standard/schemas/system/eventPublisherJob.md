---
title: eventPublisherJob | OpenMetadata Event Publisher Job
description: Connect Eventpublisherjob to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/system/eventpublisherjob
---

# EventPublisherResult

*This schema defines Event Publisher Job.*

## Properties

- **`name`** *(string)*: Name of the result.
- **`timestamp`**: Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`status`** *(string)*: This schema publisher run job status. Must be one of: `["started", "running", "completed", "failed", "active", "activeError", "stopped", "success", "stopInProgress"]`.
- **`failure`**: Failure for the job. Refer to *[./indexingError.json](#indexingError.json)*.
- **`stats`**: Refer to *[#/definitions/stats](#definitions/stats)*.
- **`entities`** *(array)*: List of Entities to Reindex.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: This schema publisher run modes.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Default: `100`.
- **`payLoadSize`** *(integer)*: Payload size in bytes depending on config. Default: `104857600`.
- **`producerThreads`** *(integer)*: Number of producer threads to use for reindexing. Default: `1`.
- **`consumerThreads`** *(integer)*: Number of consumer threads to use for reindexing. Default: `1`.
- **`queueSize`** *(integer)*: Queue Size to use internally for reindexing. Default: `100`.
- **`maxConcurrentRequests`** *(integer)*: Maximum number of concurrent requests to the search index. Default: `100`.
- **`maxRetries`** *(integer)*: Maximum number of retries for a failed request. Default: `5`.
- **`initialBackoff`** *(integer)*: Initial backoff time in milliseconds. Default: `1000`.
- **`maxBackoff`** *(integer)*: Maximum backoff time in milliseconds. Default: `10000`.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *[../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage](#/configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage)*.
- **`afterCursor`** *(string)*: Provide After in case of failure to start reindexing after the issue is solved.
## Definitions

- **`stepStats`** *(object)*: Stats for Different Steps Reader, Processor, Writer.
  - **`totalRecords`** *(integer)*: Count of Total Failed Records. Default: `0`.
  - **`successRecords`** *(integer)*: Count of Total Successfully Records. Default: `0`.
  - **`failedRecords`** *(integer)*: Count of Total Failed Records. Default: `0`.
- **`stats`** *(object)*: Cannot contain additional properties.
  - **`jobStats`**: Refer to *[#/definitions/stepStats](#definitions/stepStats)*.
  - **`entityStats`**: Refer to *[#/definitions/stepStats](#definitions/stepStats)*.
- **`runMode`** *(string)*: This schema publisher run modes. Must be one of: `["stream", "batch"]`.
- **`publisherType`** *(string)*: This schema event Publisher Types. Must be one of: `["elasticSearch", "kafka"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
