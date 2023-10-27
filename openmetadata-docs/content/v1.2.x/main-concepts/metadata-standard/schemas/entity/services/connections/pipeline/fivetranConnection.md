---
title: fivetranConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/fivetranconnection
---

# FivetranConnection

*Fivetran Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/FivetranType](#definitions/FivetranType)*. Default: `"Fivetran"`.
- **`apiKey`** *(string)*: Fivetran API Secret.
- **`hostPort`** *(string, format: uri)*: Pipeline Service Management/UI URI. Default: `"https://api.fivetran.com"`.
- **`apiSecret`** *(string, format: password)*: Fivetran API Secret.
- **`limit`** *(integer)*: Fivetran API Limit For Pagination. Default: `1000`.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/FivetranType"></a>**`FivetranType`** *(string)*: Service type. Must be one of: `["Fivetran"]`. Default: `"Fivetran"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
