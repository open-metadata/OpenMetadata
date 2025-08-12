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
- **`apiVersion`** *(string)*: Airbyte API version. Default: `api/v1`.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`AirbyteType`** *(string)*: Service type. Must be one of: `['Airbyte']`. Default: `Airbyte`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
