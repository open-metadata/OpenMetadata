---
title: tableauConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/tableauconnection
---

# TableauConnection

*Tableau Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/tableauType*. Default: `Tableau`.
- **`hostPort`** *(string)*: Tableau Server url.
- **`authType`**: Types of methods used to authenticate to the tableau instance.
- **`siteName`** *(string)*: Tableau Site Name. Default: `None`.
- **`paginationLimit`** *(integer)*: Pagination limit used while querying the tableau metadata API for getting data sources. Default: `10`.
- **`apiVersion`** *(string)*: Tableau API version. If not provided, the version will be used from the tableau server. Default: `None`.
- **`proxyURL`** *(string)*: Proxy URL for the tableau server. If not provided, the hostPort will be used. This is used to generate the dashboard & Chart URL. Default: `None`.
- **`verifySSL`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL*. Default: `no-ssl`.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`tableauType`** *(string)*: Tableau service type. Must be one of: `['Tableau']`. Default: `Tableau`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
