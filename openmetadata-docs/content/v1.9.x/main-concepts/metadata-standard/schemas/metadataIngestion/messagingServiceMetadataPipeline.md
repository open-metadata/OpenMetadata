---
title: messagingServiceMetadataPipeline | Official Documentation
description: Connect Messagingservicemetadatapipeline to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations
slug: /main-concepts/metadata-standard/schemas/metadataingestion/messagingservicemetadatapipeline
---

# MessagingServiceMetadataPipeline

*MessagingService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/messagingMetadataConfigType](#definitions/messagingMetadataConfigType)*. Default: `"MessagingMetadata"`.
- **`topicFilterPattern`**: Regex to only fetch topics that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`generateSampleData`** *(boolean)*: Option to turn on/off generating sample data during metadata extraction. Default: `false`.
- **`markDeletedTopics`** *(boolean)*: Optional configuration to soft delete topics in OpenMetadata if the source topics are deleted. Also, if the topic is deleted, all the associated entities like sample data, lineage, etc., with that topic will be deleted. Default: `true`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `false`.
## Definitions

- **`messagingMetadataConfigType`** *(string)*: Messaging Source Config Metadata Pipeline type. Must be one of: `["MessagingMetadata"]`. Default: `"MessagingMetadata"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
