---
title: createEventPublisherJob | Official Documentation
description: Connect Createeventpublisherjob to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/api/createeventpublisherjob
---

# CreateEventPublisherJob

*This schema defines Event Publisher Run Result.*

## Properties

- **`name`** *(string)*: Name of the result.
- **`publisherType`**: Publisher Type. Refer to *[../system/eventPublisherJob.json#/definitions/publisherType](#/system/eventPublisherJob.json#/definitions/publisherType)*.
- **`runMode`**: This schema publisher run modes. Refer to *[../system/eventPublisherJob.json#/definitions/runMode](#/system/eventPublisherJob.json#/definitions/runMode)*.
- **`entities`** *(array)*: List of Entities to Reindex. Default: `["all"]`.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: This schema publisher run modes. Default: `false`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 100). Default: `100`.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *[../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage](#/configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage)*.
- **`afterCursor`** *(string)*: Provide After in case of failure to start reindexing after the issue is solved.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
