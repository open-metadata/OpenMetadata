---
title: createDataInsightChart | Official Documentation
description: Create a new chart to visualize data insights and track metadata activity or KPIs over time.
slug: /main-concepts/metadata-standard/schemas/api/datainsight/createdatainsightchart
---

# CreateDataInsightChart

*Payload to create a data insight chart*

## Properties

- **`name`**: Name that identifies this data insight chart. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name the data insight chart.
- **`description`**: Description of the data insight chart. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`dataIndexType`**: Elasticsearch index name. Refer to *[../../dataInsight/dataInsightChart.json#/definitions/dataReportIndex](#/../dataInsight/dataInsightChart.json#/definitions/dataReportIndex)*.
- **`dimensions`** *(array)*: Dimensions of the chart.
  - **Items**: Refer to *[../../dataInsight/dataInsightChart.json#/definitions/chartParameterValues](#/../dataInsight/dataInsightChart.json#/definitions/chartParameterValues)*.
- **`metrics`** *(array)*: Metrics of the chart.
  - **Items**: Refer to *[../../dataInsight/dataInsightChart.json#/definitions/chartParameterValues](#/../dataInsight/dataInsightChart.json#/definitions/chartParameterValues)*.
- **`owners`**: Owners of this chart. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
