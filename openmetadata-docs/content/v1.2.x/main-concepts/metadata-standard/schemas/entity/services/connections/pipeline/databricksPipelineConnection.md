---
title: databricksPipelineConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/databrickspipelineconnection
---

# DatabricksPipelineConnection

*Databricks Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/databricksType*. Default: `DatabricksPipeline`.
- **`hostPort`** *(string)*: Host and port of the Databricks service.
- **`token`** *(string)*: Generated Token to connect to Databricks.
- **`httpPath`** *(string)*: Databricks compute resources URL.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`databricksType`** *(string)*: Service type. Must be one of: `['DatabricksPipeline']`. Default: `DatabricksPipeline`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
