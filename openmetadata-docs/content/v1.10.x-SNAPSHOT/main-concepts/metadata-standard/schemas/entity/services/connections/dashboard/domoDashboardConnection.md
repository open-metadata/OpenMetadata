---
title: domoDashboardConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/domodashboardconnection
---

# DomoDashboardConnection

*Domo Dashboard Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/domoDashboardType*. Default: `DomoDashboard`.
- **`clientId`** *(string)*: Client ID for DOMO.
- **`secretToken`** *(string)*: Secret Token to connect DOMO.
- **`accessToken`** *(string)*: Access token to connect to DOMO.
- **`apiHost`** *(string)*: API Host to connect to DOMO instance. Default: `api.domo.com`.
- **`instanceDomain`** *(string)*: URL of your Domo instance, e.g., https://openmetadata.domo.com.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`domoDashboardType`** *(string)*:  service type. Must be one of: `['DomoDashboard']`. Default: `DomoDashboard`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
