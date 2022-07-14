---
title: messagingServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataIngestion/messagingservicemetadatapipeline
---

# MessagingServiceMetadataPipeline

*MessagingService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/messagingMetadataConfigType*. Default: `MessagingMetadata`.
- **`topicFilterPattern`**: Regex to only fetch topics that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`generateSampleData`** *(boolean)*: Option to turn on/off generating sample data during metadata extraction. Default: `False`.
## Definitions

- **`messagingMetadataConfigType`** *(string)*: Messaging Source Config Metadata Pipeline type. Must be one of: `['MessagingMetadata']`. Default: `MessagingMetadata`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
