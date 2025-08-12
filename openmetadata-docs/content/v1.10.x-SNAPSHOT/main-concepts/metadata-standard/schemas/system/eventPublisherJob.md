---
title: eventPublisherJob
slug: /main-concepts/metadata-standard/schemas/system/eventpublisherjob
---

# EventPublisherResult

*This schema defines Event Publisher Job.*

## Properties

- **`name`** *(string)*: Name of the result.
- **`timestamp`**: Refer to *../type/basic.json#/definitions/timestamp*.
- **`status`** *(string)*: This schema publisher run job status. Must be one of: `['started', 'running', 'completed', 'failed', 'active', 'activeError', 'stopped', 'success', 'stopInProgress']`.
- **`failure`**: Failure for the job. Refer to *./indexingError.json*.
- **`stats`**: Refer to *#/definitions/stats*.
- **`entities`** *(array)*: List of Entities to Reindex.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: This schema publisher run modes.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Minimum: `1`. Default: `100`.
- **`payLoadSize`** *(integer)*: Payload size in bytes depending on config. Minimum: `1`. Default: `104857600`.
- **`producerThreads`** *(integer)*: Number of producer threads to use for reindexing. Minimum: `1`. Default: `1`.
- **`consumerThreads`** *(integer)*: Number of consumer threads to use for reindexing. Minimum: `1`. Default: `1`.
- **`queueSize`** *(integer)*: Queue Size to use internally for reindexing. Minimum: `1`. Default: `100`.
- **`maxConcurrentRequests`** *(integer)*: Maximum number of concurrent requests to the search index. Minimum: `1`. Default: `100`.
- **`maxRetries`** *(integer)*: Maximum number of retries for a failed request. Minimum: `0`. Default: `5`.
- **`initialBackoff`** *(integer)*: Initial backoff time in milliseconds. Minimum: `0`. Default: `1000`.
- **`maxBackoff`** *(integer)*: Maximum backoff time in milliseconds. Minimum: `0`. Default: `10000`.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage*.
- **`afterCursor`** *(string)*: Provide After in case of failure to start reindexing after the issue is solved.
- **`autoTune`** *(boolean)*: Enable automatic performance tuning based on cluster capabilities and database entity count. Default: `False`.
- **`force`** *(boolean)*: Force reindexing even if no index mapping changes are detected. Default: `False`.
- **`slackBotToken`** *(string)*: Optional Slack bot token for sending progress notifications with real-time updates.
- **`slackChannel`** *(string)*: Slack channel ID or name (required when using bot token, e.g., 'C1234567890' or '#general').
## Definitions

- **`stepStats`** *(object)*: Stats for Different Steps Reader, Processor, Writer. Cannot contain additional properties.
  - **`totalRecords`** *(integer)*: Count of Total Failed Records. Minimum: `0`. Default: `0`.
  - **`successRecords`** *(integer)*: Count of Total Successfully Records. Minimum: `0`. Default: `0`.
  - **`failedRecords`** *(integer)*: Count of Total Failed Records. Minimum: `0`. Default: `0`.
- **`stats`** *(object)*: Cannot contain additional properties.
  - **`jobStats`**: Stats for the job. Refer to *#/definitions/stepStats*.
  - **`entityStats`** *(object)*: Stats for different entities. Keys should match entity types. Can contain additional properties.
    - **Additional Properties**: Refer to *#/definitions/stepStats*.
- **`runMode`** *(string)*: This schema publisher run modes. Must be one of: `['stream', 'batch']`.
- **`publisherType`** *(string)*: This schema event Publisher Types. Must be one of: `['elasticSearch', 'kafka']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
