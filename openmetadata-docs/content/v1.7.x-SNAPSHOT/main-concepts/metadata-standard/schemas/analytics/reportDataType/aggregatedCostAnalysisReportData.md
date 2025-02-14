---
title: aggregatedCostAnalysisReportData
slug: /main-concepts/metadata-standard/schemas/analytics/reportdatatype/aggregatedcostanalysisreportdata
---

# aggregatedCostAnalysisReportData

*Aggregated data for Cost Analysis Report.*

## Properties

- **`unusedDataAssets`**: Count and Size of the unused Data Assets over a period of time. Refer to *[#/definitions/dataAssetMetrics](#definitions/dataAssetMetrics)*.
- **`frequentlyUsedDataAssets`**: Count and Size of the frequently used Data Assets over a period of time. Refer to *[#/definitions/dataAssetMetrics](#definitions/dataAssetMetrics)*.
- **`totalSize`** *(number)*: Total Size based in Bytes.
- **`totalCount`** *(number)*: Total Count.
- **`serviceName`** *(string)*: Name of the service.
- **`serviceType`** *(string)*: Type of the service.
- **`entityType`** *(string)*: Type of the entity.
- **`serviceOwner`** *(string)*: Name of the service owner.
## Definitions

- **`dataAssetValues`** *(object)*: Count or Size in bytes of Data Assets over a time period. Cannot contain additional properties.
  - **`threeDays`**: Data Asset Count or Size for 3 days.
    - **Any of**
      - *number*
      - *null*
  - **`sevenDays`**: Data Asset Count or Size for 7 days.
    - **Any of**
      - *number*
      - *null*
  - **`fourteenDays`**: Data Asset Count or Size for 14 days.
    - **Any of**
      - *number*
      - *null*
  - **`thirtyDays`**: Data Asset Count or Size for 30 days.
    - **Any of**
      - *number*
      - *null*
  - **`sixtyDays`**: Data Asset Count or Size for 60 days.
    - **Any of**
      - *number*
      - *null*
- **`dataAssetMetrics`** *(object)*: Store the Count and Size in bytes of the Data Assets over a time period.
  - **`size`**: Size of the Data Assets over a period of time. Refer to *[#/definitions/dataAssetValues](#definitions/dataAssetValues)*.
  - **`count`**: Count of the Data Assets over a period of time. Refer to *[#/definitions/dataAssetValues](#definitions/dataAssetValues)*.
  - **`totalSize`** *(number)*: Total Size based in Bytes.
  - **`totalCount`** *(number)*: Total Count.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
