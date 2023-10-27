---
title: powerBIConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/powerbiconnection
---

# PowerBIConnection

*PowerBI Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/powerBiType](#definitions/powerBiType)*. Default: `"PowerBI"`.
- **`clientId`** *(string)*: client_id for PowerBI.
- **`clientSecret`** *(string, format: password)*: clientSecret for PowerBI.
- **`tenantId`** *(string)*: Tenant ID for PowerBI.
- **`authorityURI`** *(string)*: Authority URI for the PowerBI service. Default: `"https://login.microsoftonline.com/"`.
- **`hostPort`** *(string, format: uri)*: Dashboard URL for PowerBI service. Default: `"https://app.powerbi.com"`.
- **`scope`** *(array)*: PowerBI secrets. Default: `["https://analysis.windows.net/powerbi/api/.default"]`.
  - **Items** *(string)*
- **`pagination_entity_per_page`** *(integer)*: Entity Limit set here will be used to paginate the PowerBi APIs. Default: `100`.
- **`useAdminApis`** *(boolean)*: Fetch the PowerBI metadata using admin APIs. Default: `true`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/powerBiType"></a>**`powerBiType`** *(string)*: PowerBI service type. Must be one of: `["PowerBI"]`. Default: `"PowerBI"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
