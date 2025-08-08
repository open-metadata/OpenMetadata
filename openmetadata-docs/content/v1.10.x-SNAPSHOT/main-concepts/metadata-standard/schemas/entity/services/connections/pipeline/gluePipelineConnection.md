---
title: gluePipelineConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/gluepipelineconnection
---

# GluePipelineConnection

*Glue Pipeline Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/glueType*. Default: `GluePipeline`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`glueType`** *(string)*: Service type. Must be one of: `['GluePipeline']`. Default: `GluePipeline`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
