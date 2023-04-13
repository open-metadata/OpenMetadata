---
title: dataInsightChartResult
slug: /main-concepts/metadata-standard/schemas/datainsight/datainsightchartresult
---

# DataInsightChartResult

*DataInsightChartResult represents data that will be consumed by a specific chart*

## Properties

- **`chartType`**: Chart Type that will consume the data. Must match name of dataInsightChart. Refer to *#/definitions/dataInsightChartType*.
- **`data`** *(array)*: Array of consumable data.
  - **Items**
## Definitions

- **`dataInsightChartType`** *(string)*: chart type. Must match `name` of a `dataInsightChartDefinition`. Must be one of: `['TotalEntitiesByType', 'TotalEntitiesByTier', 'PercentageOfEntitiesWithDescriptionByType', 'PercentageOfEntitiesWithOwnerByType', 'DailyActiveUsers', 'MostActiveUsers', 'MostViewedEntities', 'PageViewsByEntities']`.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
