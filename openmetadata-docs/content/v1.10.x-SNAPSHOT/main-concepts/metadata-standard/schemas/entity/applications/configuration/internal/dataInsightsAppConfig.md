---
title: dataInsightsAppConfig
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/internal/datainsightsappconfig
---

# DataInsightsAppConfig

*No configuration needed to instantiate the Data Insights Pipeline. The logic is handled in the backend.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/dataInsightsAppType*. Default: `DataInsights`.
- **`batchSize`** *(integer)*: Maximum number of events processed at a time (Default 100). Minimum: `0`. Default: `100`.
- **`recreateDataAssetsIndex`** *(boolean)*: Recreates the DataAssets index on DataInsights. Useful if you changed a Custom Property Type and are facing errors. Bear in mind that recreating the index will delete your DataAssets and a backfill will be needed. Default: `False`.
- **`backfillConfiguration`**: Refer to *#/definitions/backfillConfiguration*.
- **`moduleConfiguration`**: Refer to *#/definitions/moduleConfiguration*.
## Definitions

- **`dataInsightsAppType`** *(string)*: Application Type. Must be one of: `['DataInsights']`. Default: `DataInsights`.
- **`backfillConfiguration`** *(object)*: Backfill Configuration.
  - **`enabled`** *(boolean)*: Enable Backfill for the configured dates.
  - **`startDate`** *(string)*: Date from which to start the backfill.
  - **`endDate`** *(string)*: Date for which the backfill will end.
- **`dataAssetsConfig`** *(object)*: Cannot contain additional properties.
  - **`enabled`** *(boolean)*: If Enabled, Data Asset insights will be populated when the App runs. Default: `True`.
  - **`entities`** *(array)*: List of Entities to Reindex. Default: `['all']`.
    - **Items** *(string)*
  - **`retention`** *(integer)*: Defines the number of days the Data Assets Insights information will be kept. After it they will be deleted. Minimum: `0`. Default: `7`.
  - **`serviceFilter`** *(object)*: Cannot contain additional properties. Default: `None`.
    - **`serviceType`** *(string)*
    - **`serviceName`** *(string)*
- **`appAnalyticsConfig`** *(object)*: Cannot contain additional properties.
  - **`enabled`** *(boolean)*: If Enabled, App Analytics insights will be populated when the App runs. Default: `True`.
- **`dataQualityConfig`** *(object)*: Cannot contain additional properties.
  - **`enabled`** *(boolean)*: If Enabled, Data Quality insights will be populated when the App runs. Default: `True`.
- **`costAnalysisConfig`** *(object)*: Cannot contain additional properties.
  - **`enabled`** *(boolean)*: If Enabled, Cost Analysis insights will be populated when the App runs. Default: `True`.
- **`moduleConfiguration`** *(object)*: Different Module Configurations. Cannot contain additional properties.
  - **`dataAssets`**: Data Assets Insights Module configuration. Refer to *#/definitions/dataAssetsConfig*.
  - **`appAnalytics`**: App Analytics Module configuration. Refer to *#/definitions/appAnalyticsConfig*.
  - **`dataQuality`**: Data Quality Insights Module configuration. Refer to *#/definitions/dataQualityConfig*.
  - **`costAnalysis`**: Cost Analysis Insights Module configuration. Refer to *#/definitions/costAnalysisConfig*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
