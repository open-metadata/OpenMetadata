---
title: supersetConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/supersetconnection
---

# SupersetConnection

*Superset Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/supersetType*. Default: `Superset`.
- **`hostPort`** *(string)*: URL for the superset instance. Default: `http://localhost:8088`.
- **`connection`**: Choose between API or database connection fetch metadata from superset.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`supersetType`** *(string)*: Superset service type. Must be one of: `['Superset']`. Default: `Superset`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
