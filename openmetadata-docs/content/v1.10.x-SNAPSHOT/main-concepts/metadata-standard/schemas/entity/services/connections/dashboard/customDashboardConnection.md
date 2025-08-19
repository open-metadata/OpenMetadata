---
title: customDashboardConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/customdashboardconnection
---

# CustomDashboardConnection

*Custom Dashboard Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom dashboard service type. Refer to *#/definitions/customDashboardType*. Default: `CustomDashboard`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`customDashboardType`** *(string)*: Custom dashboard service type. Must be one of: `['CustomDashboard']`. Default: `CustomDashboard`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
