---
title: Searchindexingappconfig | Official Documentation
description: Configuration schema for internal search indexing app settings used within platform applications.
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/internal/searchindexingappconfig
---

# SearchIndexingApp

*Search Indexing App.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/searchIndexingType](#definitions/searchIndexingType)*. Default: `"SearchIndexing"`.
- **`entities`** *(array)*: List of Entities to Reindex. Default: `["all"]`.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: This schema publisher run modes. Default: `false`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 100). Default: `100`.
- **`payLoadSize`** *(integer)*: Maximum number of events sent in a batch (Default 100). Default: `104857600`.
- **`producerThreads`** *(integer)*: Number of threads to use for reindexing. Default: `10`.
- **`consumerThreads`** *(integer)*: Number of threads to use for reindexing. Default: `10`.
- **`maxConcurrentRequests`** *(integer)*: Maximum number of concurrent requests to the search index. Default: `100`.
- **`maxRetries`** *(integer)*: Maximum number of retries for a failed request. Default: `3`.
- **`initialBackoff`** *(integer)*: Initial backoff time in milliseconds. Default: `1000`.
- **`maxBackoff`** *(integer)*: Maximum backoff time in milliseconds. Default: `10000`.
- **`queueSize`** *(integer)*: Queue Size to user internally for reindexing. Default: `100`.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *[../../../../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage](#/../../../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage)*.
## Definitions

- **`searchIndexingType`** *(string)*: Application type. Must be one of: `["SearchIndexing"]`. Default: `"SearchIndexing"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
