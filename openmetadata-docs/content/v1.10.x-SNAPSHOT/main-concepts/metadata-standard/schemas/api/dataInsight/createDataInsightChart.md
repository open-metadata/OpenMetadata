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
- **`owners`**: Owners of this chart. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`domains`** *(array)*: Fully qualified names of the domains the Data Insight Chart belongs to.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
