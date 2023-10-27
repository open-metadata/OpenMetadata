---
title: messagingServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/messagingservicemetadatapipeline
---

# MessagingServiceMetadataPipeline

*MessagingService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/messagingMetadataConfigType](#definitions/messagingMetadataConfigType)*. Default: `"MessagingMetadata"`.
- **`topicFilterPattern`**: Regex to only fetch topics that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`generateSampleData`** *(boolean)*: Option to turn on/off generating sample data during metadata extraction. Default: `false`.
- **`markDeletedTopics`** *(boolean)*: Optional configuration to soft delete topics in OpenMetadata if the source topics are deleted. Also, if the topic is deleted, all the associated entities like sample data, lineage, etc., with that topic will be deleted. Default: `true`.
## Definitions

- <a id="definitions/messagingMetadataConfigType"></a>**`messagingMetadataConfigType`** *(string)*: Messaging Source Config Metadata Pipeline type. Must be one of: `["MessagingMetadata"]`. Default: `"MessagingMetadata"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
