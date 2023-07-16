---
title: reportData
slug: /main-concepts/metadata-standard/schemas/analytics/reportdata
---

# reportData

*Report Data*

## Properties

- **`id`**: Unique identifier for a result. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.
- **`timestamp`**: timestamp for of a result ingestion. Refer to *[../type/basic.json#/definitions/timestamp](#/type/basic.json#/definitions/timestamp)*.
- **`reportDataType`** *(string)*: Type of data. Must be one of: `["EntityReportData", "WebAnalyticUserActivityReportData", "WebAnalyticEntityViewReportData"]`.
- **`data`**: Data captured.
  - **One of**
    - : Refer to *[reportDataType/entityReportData.json](#portDataType/entityReportData.json)*.
    - : Refer to *[reportDataType/webAnalyticUserActivityReportData.json](#portDataType/webAnalyticUserActivityReportData.json)*.
    - : Refer to *[reportDataType/webAnalyticEntityViewReportData.json](#portDataType/webAnalyticEntityViewReportData.json)*.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
