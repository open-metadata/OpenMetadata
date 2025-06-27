---
title: Summary Card Schema | OpenMetadata Summary Cards
slug: /main-concepts/metadata-standard/schemas/datainsight/custom/summarycard
---

# SummaryCard

*Summary Card*

## Properties

- **`type`** *(string)*: Type of the data insight chart. Must be one of: `["SummaryCard"]`. Default: `"SummaryCard"`.
- **`metrics`** *(array)*: Metrics for the data insight chart.
  - **Items**: Refer to *[#/definitions/metrics](#definitions/metrics)*.
## Definitions

- **`metrics`** *(object)*
  - **`name`** *(string)*: Name of the metric for the data insight chart.
  - **`function`**: Refer to *[dataInsightCustomChart.json#/definitions/function](#taInsightCustomChart.json#/definitions/function)*.
  - **`field`** *(string)*: Filter field for the data insight chart.
  - **`filter`** *(string)*: Filter value for the data insight chart.
  - **`treeFilter`** *(string)*: Tree filter value for the data insight chart. Needed for UI to recreate advance filter tree.
  - **`formula`** *(string)*: Formula for the data insight chart calculation.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
