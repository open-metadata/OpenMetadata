---
title: dataQualityReport | OpenMetadata Data Quality Report
description: Create a data quality report schema summarizing test results, issues found, and key metrics for data monitoring.
slug: /main-concepts/metadata-standard/schemas/tests/dataqualityreport
---

# DataQualityReport

*Data Quality report and aggregation model.*

## Properties

- **`metadata`**: Metadata for the data quality report. Refer to *[#/definitions/dataQualityReportMetadata](#definitions/dataQualityReportMetadata)*.
- **`data`** *(array)*: Data for the data quality report.
  - **Items** *(object)*: Can contain additional properties.
    - **Additional Properties** *(string)*
## Definitions

- **`dataQualityReportMetadata`** *(object)*: Schema to capture data quality reports and aggregation data.
  - **`keys`** *(array)*: Keys to identify the data quality report.
    - **Items** *(string)*
  - **`dimensions`** *(array)*: Dimensions to capture the data quality report.
    - **Items** *(string)*
  - **`metrics`** *(array)*: Metrics to capture the data quality report.
    - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
