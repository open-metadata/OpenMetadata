---
title: createDataInsightChart
slug: /main-concepts/metadata-standard/schemas/api/datainsight/createdatainsightchart
---

# CreateDataInsightChart

*Payload to create a data insight chart*

## Properties

- **`name`**: Name that identifies this data insight chart. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name the data insight chart.
- **`description`**: Description of the data insight chart. Refer to *../../type/basic.json#/definitions/markdown*.
- **`dataIndexType`**: Elasticsearch index name. Refer to *../../dataInsight/dataInsightChart.json#/definitions/dataReportIndex*.
- **`dimensions`** *(array)*: Dimensions of the chart.
  - **Items**: Refer to *../../dataInsight/dataInsightChart.json#/definitions/chartParameterValues*.
- **`metrics`** *(array)*: Metrics of the chart.
  - **Items**: Refer to *../../dataInsight/dataInsightChart.json#/definitions/chartParameterValues*.
- **`owner`**: Owner of this chart. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
