---
title: queryCostSearchResult
slug: /main-concepts/metadata-standard/schemas/entity/data/querycostsearchresult
---

# QueryCostSearchResult

*Query Cost Search Result*

## Properties

- **`queryGroups`** *(array)*: List of query groups with their metrics.
  - **Items**: Refer to *#/definitions/queryGroup*.
- **`overallStats`**: Overall statistics across all queries. Refer to *#/definitions/overallStats*.
## Definitions

- **`queryDetails`** *(object)*: Details about the query. Can contain additional properties.
  - **`query`** *(object)*: Query information. Can contain additional properties.
- **`queryGroup`** *(object)*
  - **`queryText`** *(string)*: The text of the query.
  - **`users`** *(array)*: List of users who executed the query.
    - **Items** *(string)*
  - **`totalCost`** *(number)*: Total cost of all query executions.
  - **`totalCount`** *(integer)*: Total number of query executions.
  - **`totalDuration`** *(number)*: Total duration of all query executions.
  - **`avgDuration`** *(number)*: Average duration per query execution.
  - **`queryDetails`**: Additional query details. Refer to *#/definitions/queryDetails*.
- **`overallStats`** *(object)*
  - **`totalCost`** *(number)*: Total cost across all queries.
  - **`minCost`** *(number)*: Minimum cost among all queries.
  - **`maxCost`** *(number)*: Maximum cost among all queries.
  - **`avgCost`** *(number)*: Average cost across all queries.
  - **`totalExecutionCount`** *(integer)*: Total number of query executions.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
