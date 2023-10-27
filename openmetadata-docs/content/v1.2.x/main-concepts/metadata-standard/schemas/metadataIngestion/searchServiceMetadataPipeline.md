---
title: searchServiceMetadataPipeline
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
## Definitions

- <a id="definitions/searchMetadataConfigType"></a>**`searchMetadataConfigType`** *(string)*: Search Source Config Metadata Pipeline type. Must be one of: `["SearchMetadata"]`. Default: `"SearchMetadata"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
