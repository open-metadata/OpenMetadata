---
title: supersetConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/supersetconnection
---

# SupersetConnection

*Superset Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/supersetType*. Default: `Superset`.
- **`hostPort`** *(string)*: URL for the superset instance. Default: `http://localhost:8088`.
- **`connection`**: Choose between API or database connection fetch metadata from superset. Default: `{'provider': 'db'}`.
- **`dashboardFilterPattern`**: Regex to exclude or include dashboards that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`chartFilterPattern`**: Regex exclude or include charts that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`dataModelFilterPattern`**: Regex exclude or include data models that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`projectFilterPattern`**: Regex to exclude or include projects that matches the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`supersetType`** *(string)*: Superset service type. Must be one of: `['Superset']`. Default: `Superset`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
