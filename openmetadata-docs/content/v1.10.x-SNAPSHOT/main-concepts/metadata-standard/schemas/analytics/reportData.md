---
title: reportData
slug: /main-concepts/metadata-standard/schemas/analytics/reportdata
---

# reportData

*Report Data*

## Properties

- **`id`**: Unique identifier for a result. Refer to *../type/basic.json#/definitions/uuid*.
- **`timestamp`**: timestamp for of a result ingestion. Refer to *../type/basic.json#/definitions/timestamp*.
- **`reportDataType`** *(string)*: Type of data. Must be one of: `['entityReportData', 'webAnalyticUserActivityReportData', 'webAnalyticEntityViewReportData', 'rawCostAnalysisReportData', 'aggregatedCostAnalysisReportData']`.
- **`data`**: Data captured.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
