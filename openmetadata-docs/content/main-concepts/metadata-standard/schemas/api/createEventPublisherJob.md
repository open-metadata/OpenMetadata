---
title: createEventPublisherJob
slug: /main-concepts/metadata-standard/schemas/api/createeventpublisherjob
---

# CreateEventPublisherJob

*This schema defines Event Publisher Run Result.*

## Properties

- **`publisherType`**: Refer to *../settings/eventPublisherJob.json#/definitions/publisherType*.
- **`runMode`**: Refer to *../settings/eventPublisherJob.json#/definitions/runMode*.
- **`entities`** *(array)*: List of Entities to Reindex. Default: `['all']`.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: This schema publisher run modes. Default: `False`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Default: `100`.
- **`flushIntervalInSec`** *(integer)*: Maximum time to wait before sending request to ES in seconds(Default 30). Default: `30`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
