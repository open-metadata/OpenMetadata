---
title: searchServiceMetadataPipeline | Official Documentation
description: Connect Searchservicemetadatapipeline to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/searchservicemetadatapipeline
---

# SearchServiceMetadataPipeline

*SearchService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/searchMetadataConfigType](#definitions/searchMetadataConfigType)*. Default: `"SearchMetadata"`.
- **`searchIndexFilterPattern`**: Regex to only fetch search indexes that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`markDeletedSearchIndexes`** *(boolean)*: Optional configuration to soft delete search indexes in OpenMetadata if the source search indexes are deleted. Also, if the search index is deleted, all the associated entities like lineage, etc., with that search index will be deleted. Default: `true`.
- **`includeSampleData`** *(boolean)*: Optional configuration to turn off fetching sample data for search index. Default: `true`.
- **`sampleSize`** *(integer)*: No. of records of sample data we want to ingest. Default: `10`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `false`.
- **`includeIndexTemplate`** *(boolean)*: Enable the 'Include Index Template' toggle to manage the ingestion of index template data. Default: `false`.
## Definitions

- **`searchMetadataConfigType`** *(string)*: Search Source Config Metadata Pipeline type. Must be one of: `["SearchMetadata"]`. Default: `"SearchMetadata"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
