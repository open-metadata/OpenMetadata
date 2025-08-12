---
title: dataInsightsReportAppConfig | Official Documentation
description: Define configuration settings for internal data insights reporting application, managing metrics and visualization.
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/internal/datainsightsreportappconfig
---

# DataInsightsReportAppConfig

*This schema defines configuration for Data Insights Report Application.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/dataInsightsReportAppType](#definitions/dataInsightsReportAppType)*. Default: `"DataInsightsReport"`.
- **`sendToAdmins`** *(boolean)*: Default: `true`.
- **`sendToTeams`** *(boolean)*: Default: `true`.
## Definitions

- **`dataInsightsReportAppType`** *(string)*: Application type. Must be one of: `["DataInsightsReport"]`. Default: `"DataInsightsReport"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
