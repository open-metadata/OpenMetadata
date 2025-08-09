---
title: searchServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/searchservicemetadatapipeline
---

# SearchServiceMetadataPipeline

*SearchService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/searchMetadataConfigType*. Default: `SearchMetadata`.
- **`searchIndexFilterPattern`**: Regex to only fetch search indexes that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`markDeletedSearchIndexes`** *(boolean)*: Optional configuration to soft delete search indexes in OpenMetadata if the source search indexes are deleted. Also, if the search index is deleted, all the associated entities like lineage, etc., with that search index will be deleted. Default: `True`.
- **`includeSampleData`** *(boolean)*: Optional configuration to turn off fetching sample data for search index. Default: `True`.
- **`sampleSize`** *(integer)*: No. of records of sample data we want to ingest. Default: `10`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `False`.
- **`includeIndexTemplate`** *(boolean)*: Enable the 'Include Index Template' toggle to manage the ingestion of index template data. Default: `False`.
## Definitions

- **`searchMetadataConfigType`** *(string)*: Search Source Config Metadata Pipeline type. Must be one of: `['SearchMetadata']`. Default: `SearchMetadata`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
