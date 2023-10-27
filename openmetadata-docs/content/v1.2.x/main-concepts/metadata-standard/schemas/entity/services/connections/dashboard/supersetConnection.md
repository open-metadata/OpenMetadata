---
title: supersetConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/supersetconnection
---

# SupersetConnection

*Superset Connection Config*

## Properties

- **`type`**: Service Type. Refer to *[#/definitions/supersetType](#definitions/supersetType)*. Default: `"Superset"`.
- **`hostPort`** *(string, format: uri)*: URL for the superset instance. Default: `"http://localhost:8088"`.
- **`connection`**: Choose between API or database connection fetch metadata from superset.
  - **One of**
    - : Refer to *[../../../utils/supersetApiConnection.json](#/../../utils/supersetApiConnection.json)*.
    - : Refer to *[../database/postgresConnection.json](#/database/postgresConnection.json)*.
    - : Refer to *[../database/mysqlConnection.json](#/database/mysqlConnection.json)*.
- **`supportsMetadataExtraction`**: Refer to *[../connectionBasicType.json#/definitions/supportsMetadataExtraction](#/connectionBasicType.json#/definitions/supportsMetadataExtraction)*.
## Definitions

- <a id="definitions/supersetType"></a>**`supersetType`** *(string)*: Superset service type. Must be one of: `["Superset"]`. Default: `"Superset"`.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
