---
title: messagingServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/messagingservicemetadatapipeline
---

# MessagingServiceMetadataPipeline

*MessagingService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/messagingMetadataConfigType*. Default: `MessagingMetadata`.
- **`topicFilterPattern`**: Regex to only fetch topics that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`generateSampleData`** *(boolean)*: Option to turn on/off generating sample data during metadata extraction. Default: `False`.
- **`markDeletedTopics`** *(boolean)*: Optional configuration to soft delete topics in OpenMetadata if the source topics are deleted. Also, if the topic is deleted, all the associated entities like sample data, lineage, etc., with that topic will be deleted. Default: `True`.
## Definitions

- **`messagingMetadataConfigType`** *(string)*: Messaging Source Config Metadata Pipeline type. Must be one of: `['MessagingMetadata']`. Default: `MessagingMetadata`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
