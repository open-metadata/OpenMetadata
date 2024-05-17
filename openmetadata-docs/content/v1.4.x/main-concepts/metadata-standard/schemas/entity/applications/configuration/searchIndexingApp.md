---
title: searchIndexingApp
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/searchindexingapp
---

# SearchIndexingApp

*Search Indexing App.*

## Properties

- **`entities`** *(array)*: List of Entities to Reindex. Default: `['all']`.
  - **Items** *(string)*
- **`recreateIndex`** *(boolean)*: This schema publisher run modes. Default: `False`.
- **`batchSize`** *(integer)*: Maximum number of events sent in a batch (Default 10). Default: `100`.
- **`searchIndexMappingLanguage`**: Recreate Indexes with updated Language. Refer to *../../../configuration/elasticSearchConfiguration.json#/definitions/searchIndexMappingLanguage*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
