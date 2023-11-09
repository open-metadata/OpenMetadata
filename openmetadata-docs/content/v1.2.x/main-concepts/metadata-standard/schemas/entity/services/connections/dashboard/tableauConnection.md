---
title: tableauConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/tableauconnection
---

# TableauConnection

*Tableau Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/tableauType*. Default: `Tableau`.
- **`hostPort`** *(string)*: Tableau Server.
- **`authType`**: Types of methods used to authenticate to the tableau instance.
- **`apiVersion`** *(string)*: Tableau API version.
- **`siteName`** *(string)*: Tableau Site Name.
- **`siteUrl`** *(string)*: Tableau Site Url.
- **`env`** *(string)*: Tableau Environment Name. Default: `tableau_prod`.
- **`paginationLimit`** *(integer)*: Pagination limit used while querying the tableau metadata API for getting data sources. Default: `10`.
- **`verifySSL`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL*. Default: `no-ssl`.
- **`sslConfig`**: Refer to *../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`tableauType`** *(string)*: Tableau service type. Must be one of: `['Tableau']`. Default: `Tableau`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
