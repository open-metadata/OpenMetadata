---
title: storageServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/storageservicemetadatapipeline
---

# StorageServiceMetadataPipeline

*StorageService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/storageMetadataConfigType*. Default: `StorageMetadata`.
- **`containerFilterPattern`**: Regex to only fetch containers that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
## Definitions

- **`storageMetadataConfigType`** *(string)*: Object Store Source Config Metadata Pipeline type. Must be one of: `['StorageMetadata']`. Default: `StorageMetadata`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
