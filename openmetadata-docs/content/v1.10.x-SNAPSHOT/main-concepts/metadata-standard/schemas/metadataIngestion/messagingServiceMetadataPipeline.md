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
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `False`.
## Definitions

- **`messagingMetadataConfigType`** *(string)*: Messaging Source Config Metadata Pipeline type. Must be one of: `['MessagingMetadata']`. Default: `MessagingMetadata`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
