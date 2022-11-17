---
title: dagsterConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/dagsterconnection
---

# DagsterConnection

*Dagster Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/DagsterType*. Default: `Dagster`.
- **`configSource`**: Available sources to fetch files.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`DagsterType`** *(string)*: Service type. Must be one of: `['Dagster']`. Default: `Dagster`.
- **`LocalDagtser`** *(object)*: Config to connect to local Dagster.
  - **`hostPort`** *(string)*: Pipeline Service Management/UI URI.
- **`CloudDagster`** *(object)*: Config to connect to Cloud Dagster.
  - **`host`** *(string)*: Pipeline Service Management/UI URI.
  - **`token`** *(string)*: To Connect to Dagster Cloud.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
