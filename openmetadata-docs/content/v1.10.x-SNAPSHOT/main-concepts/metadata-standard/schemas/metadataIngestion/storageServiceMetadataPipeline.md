---
title: storageServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/storageservicemetadatapipeline
---

# StorageServiceMetadataPipeline

*StorageService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/storageMetadataConfigType*. Default: `StorageMetadata`.
- **`containerFilterPattern`**: Regex to only fetch containers that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`storageMetadataConfigSource`**
- **`markDeletedContainers`** *(boolean)*: Optional configuration to soft delete containers in OpenMetadata if the source containers are deleted. Also, if the topic is deleted, all the associated entities with that containers will be deleted. Default: `True`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `False`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `False`.
## Definitions

- **`storageMetadataConfigType`** *(string)*: Object Store Source Config Metadata Pipeline type. Must be one of: `['StorageMetadata']`. Default: `StorageMetadata`.
- **`noMetadataConfigurationSource`** *(object)*: No manifest file available. Ingestion would look for bucket-level metadata file instead. Cannot contain additional properties.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
