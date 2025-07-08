---
title: Report Data Schema | OpenMetadata Report Data Models
slug: /main-concepts/metadata-standard/schemas/analytics/reportdata
---

# reportData

*Report Data*

## Properties

- **`id`**: Unique identifier for a result. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`timestamp`**: timestamp for of a result ingestion. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`reportDataType`** *(string)*: Type of data. Must be one of: `["entityReportData", "webAnalyticUserActivityReportData", "webAnalyticEntityViewReportData", "rawCostAnalysisReportData", "aggregatedCostAnalysisReportData"]`.
- **`data`**: Data captured.
  - **One of**
    - : Refer to *[reportDataType/entityReportData.json](#portDataType/entityReportData.json)*.
    - : Refer to *[reportDataType/webAnalyticUserActivityReportData.json](#portDataType/webAnalyticUserActivityReportData.json)*.
    - : Refer to *[reportDataType/webAnalyticEntityViewReportData.json](#portDataType/webAnalyticEntityViewReportData.json)*.
    - : Refer to *[reportDataType/rawCostAnalysisReportData.json](#portDataType/rawCostAnalysisReportData.json)*.
    - : Refer to *[reportDataType/aggregatedCostAnalysisReportData.json](#portDataType/aggregatedCostAnalysisReportData.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
