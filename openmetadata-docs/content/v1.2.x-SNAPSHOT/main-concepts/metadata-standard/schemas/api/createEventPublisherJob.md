---
title: createEventPublisherJob
slug: /main-concepts/metadata-standard/schemas/api/createeventpublisherjob
---

# CreateEventPublisherJob

*This schema defines Event Publisher Run Result.*

## Properties

- **`name`** *(string)*: Name of the result.
- **`publisherType`**: Refer to *../system/eventPublisherJob.json#/definitions/publisherType*.
- **`runMode`**: Refer to *../system/eventPublisherJob.json#/definitions/runMode*.
- **`entities`** *(array)*: List of Entities to Reindex. Default: `['all']`.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: This schema publisher run modes. Default: `False`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Default: `100`.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage*.
- **`afterCursor`** *(string)*: Provide After in case of failure to start reindexing after the issue is solved.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
