---
title: lookerConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/lookerconnection
---

# LookerConnection

*Looker Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/lookerType*. Default: `Looker`.
- **`username`** *(string)*: Username to connect to Looker. This user should have privileges to read all the metadata in Looker.
- **`password`** *(string)*: Password to connect to Looker.
- **`hostPort`** *(string)*: URL to the Looker instance.
- **`env`** *(string)*: Looker Environment.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`lookerType`** *(string)*: Looker service type. Must be one of: `['Looker']`. Default: `Looker`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
