---
title: aggregationRequest
slug: /main-concepts/metadata-standard/schemas/search/aggregationrequest
---

# AggregationRequest

*Request body for performing field aggregations with optional top_hits sub-aggregation.*

## Properties

- **`query`** *(string)*: Query string to be sent to the search engine. Default: ``.
- **`index`** *(string)*: Name of the index to aggregate on. Default: `table_search_index`.
- **`fieldName`** *(string)*: Field name to aggregate on (typically a keyword field like service.displayName.keyword). Default: ``.
- **`fieldValue`** *(string)*: Filter value for the aggregation include clause. Default: ``.
- **`deleted`** *(boolean)*: Whether to include deleted documents. Default: `False`.
- **`size`** *(integer)*: Size to limit the number of aggregation buckets returned. Default: `10`.
- **`sourceFields`** *(array)*: List of fields to include from _source in the response (outside of top_hits).
  - **Items** *(string)*
- **`topHits`** *(object)*: Optional top_hits sub-aggregation to fetch selected source fields per bucket. Default: `{'size': 1, 'sortField': '_doc', 'sortOrder': 'asc'}`.
  - **`size`** *(integer)*: Number of top documents to return per bucket. Default: `1`.
  - **`sortField`** *(string)*: Field to sort the top hits on. Default: `_doc`.
  - **`sortOrder`** *(string)*: Sort order for top hits - asc or desc. Must be one of: `['asc', 'desc']`. Default: `asc`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
