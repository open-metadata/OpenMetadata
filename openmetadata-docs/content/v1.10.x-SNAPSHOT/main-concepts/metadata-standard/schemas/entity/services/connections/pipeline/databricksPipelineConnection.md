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
- **`connectionTimeout`** *(number)*: Connection timeout in seconds. Default: `120`.
- **`httpPath`** *(string)*: Databricks compute resources URL.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`databricksType`** *(string)*: Service type. Must be one of: `['DatabricksPipeline']`. Default: `DatabricksPipeline`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
