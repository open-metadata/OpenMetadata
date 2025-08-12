---
title: powerBIReportServerConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbireportserverconnection
---

# PowerBIReportServerConnection

*PowerBIReportServer Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/powerBIReportServerType*. Default: `PowerBIReportServer`.
- **`hostPort`** *(string)*: Dashboard URL for PowerBI Report Server.
- **`username`** *(string)*: Username to connect to PowerBI report server.
- **`password`** *(string)*: Password to connect to PowerBI report server.
- **`webPortalVirtualDirectory`** *(string)*: Web Portal Virtual Directory Name. Default: `Reports`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
## Definitions

- **`powerBIReportServerType`** *(string)*: PowerBIReportServer service type. Must be one of: `['PowerBIReportServer']`. Default: `PowerBIReportServer`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
