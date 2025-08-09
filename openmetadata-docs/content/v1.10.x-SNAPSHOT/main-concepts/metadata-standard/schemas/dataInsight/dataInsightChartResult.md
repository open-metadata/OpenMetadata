---
title: dataInsightChartResult
slug: /main-concepts/metadata-standard/schemas/datainsight/datainsightchartresult
---

# DataInsightChartResult

*DataInsightChartResult represents data that will be consumed by a specific chart*

## Properties

- **`chartType`**: Chart Type that will consume the data. Must match name of dataInsightChart. Refer to *#/definitions/dataInsightChartType*.
- **`total`** *(integer)*: Total number of hits returned by the aggregation.
- **`data`** *(array)*: Array of consumable data.
  - **Items**
## Definitions

- **`dataInsightChartType`** *(string)*: chart type. Must match `name` of a `dataInsightChartDefinition`. Must be one of: `['DailyActiveUsers', 'MostActiveUsers', 'MostViewedEntities', 'PageViewsByEntities', 'UnusedAssets', 'AggregatedUnusedAssetsSize', 'AggregatedUnusedAssetsCount', 'AggregatedUsedVsUnusedAssetsSize', 'AggregatedUsedVsUnusedAssetsCount']`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
