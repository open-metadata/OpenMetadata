---
title: Tableau Connection | OpenMetadata Tableau
description: Set up Tableau dashboard connections using this schema to manage chart-level metadata, data sources, and lineage insights.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/tableauconnection
---

# TableauConnection

*Tableau Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/tableauType](#definitions/tableauType)*. Default: `"Tableau"`.
- **`hostPort`** *(string, format: uri)*: Tableau Server.
- **`authType`**: Types of methods used to authenticate to the tableau instance.
  - **One of**
    - : Refer to *[../../../../security/credentials/basicAuth.json](#/../../../security/credentials/basicAuth.json)*.
    - : Refer to *[../../../../security/credentials/accessTokenAuth.json](#/../../../security/credentials/accessTokenAuth.json)*.
- **`apiVersion`** *(string)*: Tableau API version.
- **`siteName`** *(string)*: Tableau Site Name.
- **`siteUrl`** *(string)*: Tableau Site Url.
- **`env`** *(string)*: Tableau Environment Name. Default: `"tableau_prod"`.
- **`paginationLimit`** *(integer)*: Pagination limit used while querying the tableau metadata API for getting data sources. Default: `10`.
- **`verifySSL`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL](#/../../../security/ssl/verifySSLConfig.json#/definitions/verifySSL)*. Default: `"no-ssl"`.
- **`sslConfig`**: Refer to *[../../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../../../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- **`tableauType`** *(string)*: Tableau service type. Must be one of: `["Tableau"]`. Default: `"Tableau"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
