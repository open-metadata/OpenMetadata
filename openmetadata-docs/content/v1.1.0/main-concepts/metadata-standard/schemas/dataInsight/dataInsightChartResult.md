---
title: dataInsightChartResult
slug: /main-concepts/metadata-standard/schemas/datainsight/datainsightchartresult
---

# DataInsightChartResult

*DataInsightChartResult represents data that will be consumed by a specific chart*

## Properties

- **`chartType`**: Chart Type that will consume the data. Must match name of dataInsightChart. Refer to *[#/definitions/dataInsightChartType](#definitions/dataInsightChartType)*.
- **`data`** *(array)*: Array of consumable data.
  - **Items**
    - **Any of**
      - : Refer to *[./type/percentageOfEntitiesWithDescriptionByType.json](#type/percentageOfEntitiesWithDescriptionByType.json)*.
      - : Refer to *[./type/percentageOfEntitiesWithOwnerByType.json](#type/percentageOfEntitiesWithOwnerByType.json)*.
      - : Refer to *[./type/totalEntitiesByTier.json](#type/totalEntitiesByTier.json)*.
      - : Refer to *[./type/totalEntitiesByType.json](#type/totalEntitiesByType.json)*.
      - : Refer to *[./type/dailyActiveUsers.json](#type/dailyActiveUsers.json)*.
      - : Refer to *[./type/pageViewsByEntities.json](#type/pageViewsByEntities.json)*.
      - : Refer to *[type/mostActiveUsers.json](#pe/mostActiveUsers.json)*.
      - : Refer to *[type/mostViewedEntities.json](#pe/mostViewedEntities.json)*.
## Definitions

- <a id="definitions/dataInsightChartType"></a>**`dataInsightChartType`** *(string)*: chart type. Must match `name` of a `dataInsightChartDefinition`. Must be one of: `["TotalEntitiesByType", "TotalEntitiesByTier", "PercentageOfEntitiesWithDescriptionByType", "PercentageOfEntitiesWithOwnerByType", "DailyActiveUsers", "MostActiveUsers", "MostViewedEntities", "PageViewsByEntities"]`.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
