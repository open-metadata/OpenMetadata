---
title: Superset Connection | OpenMetadata Superset
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

- **`supersetType`** *(string)*: Superset service type. Must be one of: `["Superset"]`. Default: `"Superset"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
