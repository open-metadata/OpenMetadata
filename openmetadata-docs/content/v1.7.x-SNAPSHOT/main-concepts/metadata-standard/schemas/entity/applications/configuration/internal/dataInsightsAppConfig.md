---
title: dataInsightsAppConfig
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/internal/datainsightsappconfig
---

# DataInsightsAppConfig

*No configuration needed to instantiate the Data Insights Pipeline. The logic is handled in the backend.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/dataInsightsAppType](#definitions/dataInsightsAppType)*. Default: `"DataInsights"`.
- **`batchSize`** *(integer)*: Maximum number of events processed at a time (Default 100). Default: `100`.
- **`recreateDataAssetsIndex`** *(boolean)*: Recreates the DataAssets index on DataInsights. Useful if you changed a Custom Property Type and are facing errors. Bear in mind that recreating the index will delete your DataAssets and a backfill will be needed. Default: `false`.
- **`backfillConfiguration`**: Refer to *[#/definitions/backfillConfiguration](#definitions/backfillConfiguration)*.
## Definitions

- **`dataInsightsAppType`** *(string)*: Application Type. Must be one of: `["DataInsights"]`. Default: `"DataInsights"`.
- **`backfillConfiguration`** *(object)*: Backfill Configuration.
  - **`enabled`** *(boolean)*: Enable Backfill for the configured dates.
  - **`startDate`** *(string, format: date)*: Date from which to start the backfill.
  - **`endDate`** *(string, format: date)*: Date for which the backfill will end.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
