---
title: dagsterConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/dagsterconnection
---

# DagsterConnection

*Dagster Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/DagsterType*. Default: `Dagster`.
- **`hostPort`** *(string)*: Pipeline Service Management/UI URI.
- **`numberOfStatus`** *(integer)*: Pipeline Service Number Of Status. Default: `10`.
- **`dbConnection`**: Underlying database connection. See https://docs.dagster.io/getting-started for supported backends.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`DagsterType`** *(string)*: Service type. Must be one of: `['Dagster']`. Default: `Dagster`.


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
