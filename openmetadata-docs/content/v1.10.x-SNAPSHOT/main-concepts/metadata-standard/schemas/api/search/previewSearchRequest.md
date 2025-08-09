---
title: previewSearchRequest
slug: /main-concepts/metadata-standard/schemas/api/search/previewsearchrequest
---

# PreviewSearchRequest

*Preview Search Results*

## Properties

- **`query`** *(string)*: The query text to execute against the search index.
- **`index`** *(string)*: The index to run the query against (e.g., table_search_index).
- **`searchSettings`**: Refer to *../../configuration/searchSettings.json*.
- **`from`** *(integer)*: Pagination start index. Default: `0`.
- **`size`** *(integer)*: Number of results to return. Default: `10`.
- **`sortField`** *(string)*: Default: `_score`.
- **`sortOrder`** *(string)*: Must be one of: `['asc', 'desc']`. Default: `desc`.
- **`trackTotalHits`** *(boolean)*: Default: `False`.
- **`queryFilter`** *(string)*
- **`postFilter`** *(string)*
- **`fetchSource`** *(boolean)*: Default: `True`.
- **`includeSourceFields`** *(array)*
  - **Items** *(string)*
- **`explain`** *(boolean)*: Default: `False`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
