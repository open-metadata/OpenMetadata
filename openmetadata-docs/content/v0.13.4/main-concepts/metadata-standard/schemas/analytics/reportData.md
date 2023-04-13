---
title: reportData
slug: /main-concepts/metadata-standard/schemas/analytics/reportdata
---

# reportData

*Report Data*

## Properties

- **`id`**: Unique identifier for a result. Refer to *../type/basic.json#/definitions/uuid*.
- **`timestamp`**: timestamp for of a result ingestion. Refer to *../type/basic.json#/definitions/timestamp*.
- **`reportDataType`** *(string)*: Type of data. Must be one of: `['EntityReportData', 'WebAnalyticUserActivityReportData', 'WebAnalyticEntityViewReportData']`.
- **`data`**: Data captured.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
