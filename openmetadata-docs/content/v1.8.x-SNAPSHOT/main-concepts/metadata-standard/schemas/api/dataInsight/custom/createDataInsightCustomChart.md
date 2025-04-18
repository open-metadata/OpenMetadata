---
title: createDataInsightCustomChart
slug: /main-concepts/metadata-standard/schemas/api/datainsight/custom/createdatainsightcustomchart
---

# CreateDataInsightCustomChart

*Payload to create a data insight custom chart*

## Properties

- **`name`**: Name that identifies this data insight chart. Refer to *[../../../type/basic.json#/definitions/entityName](#/../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name the data insight chart.
- **`description`**: Description of the data insight chart. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`chartType`** *(string)*: Type of chart, used for UI to render the chart. Must be one of: `["LineChart", "AreaChart", "BarChart", "SummaryCard"]`.
- **`chartDetails`**
  - **One of**
    - : Refer to *[../../../dataInsight/custom/lineChart.json](#/../../dataInsight/custom/lineChart.json)*.
    - : Refer to *[../../../dataInsight/custom/summaryCard.json](#/../../dataInsight/custom/summaryCard.json)*.
- **`owner`**: Owner of this chart. Refer to *[../../../type/entityReference.json](#/../../type/entityReference.json)*.
- **`dashboard`**: Dashboard where this chart is displayed. Refer to *[../../../type/entityReference.json](#/../../type/entityReference.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
