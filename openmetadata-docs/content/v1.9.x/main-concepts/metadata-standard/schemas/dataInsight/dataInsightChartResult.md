---
title: dataInsightChartResult | Official Documentation
description: Connect Datainsightchartresult to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/datainsight/datainsightchartresult
---

# DataInsightChartResult

*DataInsightChartResult represents data that will be consumed by a specific chart*

## Properties

- **`chartType`**: Chart Type that will consume the data. Must match name of dataInsightChart. Refer to *[#/definitions/dataInsightChartType](#definitions/dataInsightChartType)*.
- **`total`** *(integer)*: Total number of hits returned by the aggregation.
- **`data`** *(array)*: Array of consumable data.
  - **Items**
    - **Any of**
      - : Refer to *[./type/dailyActiveUsers.json](#type/dailyActiveUsers.json)*.
      - : Refer to *[./type/pageViewsByEntities.json](#type/pageViewsByEntities.json)*.
      - : Refer to *[type/mostActiveUsers.json](#pe/mostActiveUsers.json)*.
      - : Refer to *[type/mostViewedEntities.json](#pe/mostViewedEntities.json)*.
      - : Refer to *[type/unusedAssets.json](#pe/unusedAssets.json)*.
      - : Refer to *[type/aggregatedUnusedAssetsSize.json](#pe/aggregatedUnusedAssetsSize.json)*.
      - : Refer to *[type/aggregatedUnusedAssetsCount.json](#pe/aggregatedUnusedAssetsCount.json)*.
      - : Refer to *[type/aggregatedUsedVsUnusedAssetsSize.json](#pe/aggregatedUsedVsUnusedAssetsSize.json)*.
      - : Refer to *[type/aggregatedUsedVsUnusedAssetsCount.json](#pe/aggregatedUsedVsUnusedAssetsCount.json)*.
## Definitions

- **`dataInsightChartType`** *(string)*: chart type. Must match `name` of a `dataInsightChartDefinition`. Must be one of: `["DailyActiveUsers", "MostActiveUsers", "MostViewedEntities", "PageViewsByEntities", "UnusedAssets", "AggregatedUnusedAssetsSize", "AggregatedUnusedAssetsCount", "AggregatedUsedVsUnusedAssetsSize", "AggregatedUsedVsUnusedAssetsCount"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
