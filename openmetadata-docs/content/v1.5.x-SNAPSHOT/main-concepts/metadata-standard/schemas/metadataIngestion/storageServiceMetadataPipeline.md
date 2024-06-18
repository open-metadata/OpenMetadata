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
## Definitions

- **`storageMetadataConfigType`** *(string)*: Object Store Source Config Metadata Pipeline type. Must be one of: `['StorageMetadata']`. Default: `StorageMetadata`.
- **`noMetadataConfigurationSource`** *(object)*: No manifest file available. Ingestion would look for bucket-level metadata file instead. Cannot contain additional properties.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
