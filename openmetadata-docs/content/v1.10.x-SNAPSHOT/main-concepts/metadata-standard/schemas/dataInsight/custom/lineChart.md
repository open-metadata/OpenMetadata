---
title: lineChart
slug: /main-concepts/metadata-standard/schemas/datainsight/custom/linechart
---

# LineChart

*Line Chart*

## Properties

- **`type`** *(string)*: Type of the data insight chart. Must be one of: `['LineChart']`. Default: `LineChart`.
- **`metrics`** *(array)*: Metrics for the data insight chart.
  - **Items**: Refer to *#/definitions/metrics*.
- **`groupBy`** *(string)*: Breakdown field for the data insight chart.
- **`includeGroups`** *(array)*: List of groups to be included in the data insight chart when groupBy is specified.
  - **Items** *(string)*
- **`excludeGroups`** *(array)*: List of groups to be excluded in the data insight chart when groupBy is specified.
  - **Items** *(string)*
- **`xAxisLabel`** *(string)*: X-axis label for the data insight chart.
- **`yAxisLabel`** *(string)*: Y-axis label for the data insight chart.
- **`kpiDetails`**: Refer to *dataInsightCustomChart.json#/definitions/kpiDetails*.
- **`xAxisField`** *(string)*: X-axis field for the data insight chart. Default: `@timestamp`.
- **`includeXAxisFiled`** *(string)*: Regex to include fields in the data insight chart when xAxisField is specified.
- **`excludeXAxisField`** *(string)*: Regex to exclude fields from the data insight chart when xAxisField is specified.
- **`searchIndex`** *(string)*: Search index for the data insight chart.
## Definitions

- **`metrics`** *(object)*
  - **`name`** *(string)*: Name of the metric for the data insight chart.
  - **`function`**: Refer to *dataInsightCustomChart.json#/definitions/function*.
  - **`field`** *(string)*: Filter field for the data insight chart.
  - **`filter`** *(string)*: Filter value for the data insight chart.
  - **`treeFilter`** *(string)*: Tree filter value for the data insight chart. Needed for UI to recreate advance filter tree.
  - **`formula`** *(string)*: Formula for the data insight chart calculation.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
