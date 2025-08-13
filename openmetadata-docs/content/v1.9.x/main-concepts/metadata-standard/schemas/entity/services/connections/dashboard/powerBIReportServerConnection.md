---
title: powerBIReportServerConnection | Official Documentation
description: Power BI Report Server connection schema supporting on-premises dashboards with secure tokens.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbireportserverconnection
---

# PowerBIReportServerConnection

*PowerBIReportServer Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/powerBIReportServerType](#definitions/powerBIReportServerType)*. Default: `"PowerBIReportServer"`.
- **`hostPort`** *(string, format: uri)*: Dashboard URL for PowerBI Report Server.
- **`username`** *(string)*: Username to connect to PowerBI report server.
- **`password`** *(string, format: password)*: Password to connect to PowerBI report server.
- **`webPortalVirtualDirectory`** *(string)*: Web Portal Virtual Directory Name. Default: `"Reports"`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`powerBIReportServerType`** *(string)*: PowerBIReportServer service type. Must be one of: `["PowerBIReportServer"]`. Default: `"PowerBIReportServer"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
