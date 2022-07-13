---
title: supersetConnection
slug: /main-concepts/metadata-standard/schemas/schema/entity/services/connections/dashboard
---

# SupersetConnection

*Superset Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/supersetType*. Default: `Superset`.
- **`hostPort`** *(string)*: URL for the superset instance. Default: `http://localhost:8088`.
- **`username`** *(string)*: Username for Superset.
- **`password`** *(string)*: Password for Superset.
- **`provider`** *(string)*: Authentication provider for the Superset service. Default: `db`.
- **`connectionOptions`** *(object)*: Additional connection options that can be sent to service during the connection.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`supersetType`** *(string)*: Superset service type. Must be one of: `['Superset']`. Default: `Superset`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
