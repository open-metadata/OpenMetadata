---
title: slackEventPubConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/slackeventpubconfiguration
---

# SlackPublisherConfiguration

*This schema defines the Authentication Configuration.*

## Properties

- **`name`** *(string)*: Publisher Name.
- **`webhookUrl`** *(string)*: Webhook URL.
- **`openMetadataUrl`** *(string)*: OpenMetadata URL.
- **`filters`** *(array)*: Filters.
  - **Items**: Refer to *../type/changeEvent.json#/definitions/eventFilter*.
- **`batchSize`** *(integer)*: Batch Size. Default: `10`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
