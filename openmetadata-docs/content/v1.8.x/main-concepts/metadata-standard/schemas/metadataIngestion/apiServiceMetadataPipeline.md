---
title: apiServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/apiservicemetadatapipeline
---

# ApiServiceMetadataPipeline

*ApiService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/ApiMetadataConfigType](#definitions/ApiMetadataConfigType)*. Default: `"ApiMetadata"`.
- **`apiCollectionFilterPattern`**: Regex to only fetch api collections with names matching the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`markDeletedApiCollections`** *(boolean)*: Optional configuration to soft delete api collections in OpenMetadata if the source collections are deleted. Also, if the collection is deleted, all the associated entities like endpoints, etc., with that collection will be deleted. Default: `true`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `false`.
## Definitions

- **`ApiMetadataConfigType`** *(string)*: Api Source Config Metadata Pipeline type. Must be one of: `["ApiMetadata"]`. Default: `"ApiMetadata"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
