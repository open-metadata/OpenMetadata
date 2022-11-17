---
title: airbyteConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/airbyteconnection
---

# AirbyteConnection

*Airbyte Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/AirbyteType*. Default: `Airbyte`.
- **`hostPort`** *(string)*: Pipeline Service Management/UI URL.
- **`username`** *(string)*: Username to connect to Airbyte.
- **`password`** *(string)*: Password to connect to Airbyte.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`AirbyteType`** *(string)*: Service type. Must be one of: `['Airbyte']`. Default: `Airbyte`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
