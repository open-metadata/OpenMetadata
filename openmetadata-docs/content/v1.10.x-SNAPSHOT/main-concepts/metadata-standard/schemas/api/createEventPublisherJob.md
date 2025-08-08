---
title: createEventPublisherJob
slug: /main-concepts/metadata-standard/schemas/api/createeventpublisherjob
---

# CreateEventPublisherJob

*This schema defines Event Publisher Run Result.*

## Properties

- **`name`** *(string)*: Name of the result.
- **`publisherType`**: Publisher Type. Refer to *../system/eventPublisherJob.json#/definitions/publisherType*.
- **`runMode`**: This schema publisher run modes. Refer to *../system/eventPublisherJob.json#/definitions/runMode*.
- **`entities`** *(array)*: List of Entities to Reindex. Default: `['all']`.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: This schema publisher run modes. Default: `False`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 100). Default: `100`.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage*.
- **`afterCursor`** *(string)*: Provide After in case of failure to start reindexing after the issue is solved.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
