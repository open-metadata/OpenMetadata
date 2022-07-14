---
title: tableauConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/tableauconnection
---

# TableauConnection

*Tableau Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/tableauType*. Default: `Tableau`.
- **`hostPort`** *(string)*: Tableau Server.
- **`username`** *(string)*: Username for Tableau.
- **`password`** *(string)*: Password for Tableau.
- **`apiVersion`** *(string)*: Tableau API version.
- **`siteName`** *(string)*: Tableau Site Name.
- **`personalAccessTokenName`** *(string)*: Personal Access Token Name.
- **`personalAccessTokenSecret`** *(string)*: Personal Access Token Secret.
- **`env`** *(string)*: Tableau Environment Name. Default: `tableau_prod`.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`tableauType`** *(string)*: Tableau service type. Must be one of: `['Tableau']`. Default: `Tableau`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
