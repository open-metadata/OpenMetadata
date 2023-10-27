---
title: storageServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/storageservicemetadatapipeline
---

# StorageServiceMetadataPipeline

*StorageService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/storageMetadataConfigType](#definitions/storageMetadataConfigType)*. Default: `"StorageMetadata"`.
- **`containerFilterPattern`**: Regex to only fetch containers that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`storageMetadataConfigSource`**
  - **One of**
    - : Refer to *[#/definitions/noMetadataConfigurationSource](#definitions/noMetadataConfigurationSource)*.
    - : Refer to *[./storage/storageMetadataLocalConfig.json](#storage/storageMetadataLocalConfig.json)*.
    - : Refer to *[./storage/storageMetadataHttpConfig.json](#storage/storageMetadataHttpConfig.json)*.
    - : Refer to *[./storage/storageMetadataS3Config.json](#storage/storageMetadataS3Config.json)*.
    - : Refer to *[./storage/storageMetadataADLSConfig.json](#storage/storageMetadataADLSConfig.json)*.
## Definitions

- <a id="definitions/storageMetadataConfigType"></a>**`storageMetadataConfigType`** *(string)*: Object Store Source Config Metadata Pipeline type. Must be one of: `["StorageMetadata"]`. Default: `"StorageMetadata"`.
- <a id="definitions/noMetadataConfigurationSource"></a>**`noMetadataConfigurationSource`** *(object)*: No manifest file available. Ingestion would look for bucket-level metadata file instead. Cannot contain additional properties.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
