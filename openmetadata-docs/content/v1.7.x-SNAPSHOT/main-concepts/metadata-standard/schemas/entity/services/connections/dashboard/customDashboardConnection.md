---
title: customDashboardConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/customdashboardconnection
---

# CustomDashboardConnection

*Custom Dashboard Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom dashboard service type. Refer to *[#/definitions/customDashboardType](#definitions/customDashboardType)*. Default: `"CustomDashboard"`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
## Definitions

- **`customDashboardType`** *(string)*: Custom dashboard service type. Must be one of: `["CustomDashboard"]`. Default: `"CustomDashboard"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
