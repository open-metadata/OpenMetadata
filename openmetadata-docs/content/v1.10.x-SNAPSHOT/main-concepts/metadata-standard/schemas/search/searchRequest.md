---
title: searchRequest
slug: /main-concepts/metadata-standard/schemas/search/searchrequest
---

# SearchRequest

*Search Request to find entities from Elastic Search based on different parameters.*

## Properties

- **`query`** *(string)*: Query to be send to Search Engine. Default: `*`.
- **`index`** *(string)*: Index Name. Default: `table_search_index`.
- **`fieldName`** *(string)*: Field Name to match. Default: `suggest`.
- **`from`** *(integer)*: Start Index for the req. Default: `0`.
- **`size`** *(integer)*: Size to limit the no.of results returned. Default: `10`.
- **`queryFilter`** *(string)*: Elasticsearch query that will be combined with the query_string query generator from the `query` arg.
- **`postFilter`** *(string)*: Elasticsearch query that will be used as a post_filter.
- **`fetchSource`** *(boolean)*: Get document body for each hit. Default: `True`.
- **`trackTotalHits`** *(boolean)*: Track Total Hits. Default: `False`.
- **`explain`** *(boolean)*: Explain the results of the query. Defaults to false. Only for debugging purposes. Default: `False`.
- **`deleted`** *(boolean)*: Filter documents by deleted param. Default: `None`.
- **`sortFieldParam`** *(string)*: Sort the search results by field, available fields to sort weekly_stats daily_stats, monthly_stats, last_updated_timestamp. Default: `_score`.
- **`sortOrder`** *(string)*: Sort order asc for ascending or desc for descending, defaults to desc. Default: `desc`.
- **`includeSourceFields`** *(array)*: Get only selected fields of the document body for each hit. Empty value will return all fields.
  - **Items** *(string)*
- **`excludeSourceFields`** *(array)*: Exclude specified fields from the document body for each hit. Use this to exclude heavy fields like 'columns' for better performance.
  - **Items** *(string)*
- **`searchAfter`**: When paginating, specify the search_after values. Use it ass search_after=<val1>,<val2>,...
- **`domains`**: Internal Object to filter by Domains.
- **`applyDomainFilter`** *(boolean)*: If Need to apply the domain filter.
- **`isHierarchy`** *(boolean)*: If true it will try to get the hierarchy of the entity. Default: `False`.
- **`fieldValue`** *(string)*: Field Value in case of Aggregations.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
