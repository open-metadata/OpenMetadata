---
title: vertexaiConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/mlmodel/vertexaiconnection
---

# VertexAIConnection

*Google VertexAI Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/vertexAIType*. Default: `VertexAI`.
- **`credentials`**: GCP Credentials. Refer to *../../../../security/credentials/gcpCredentials.json*.
- **`location`** *(string)*: location/region of google cloud project.
- **`mlModelFilterPattern`**: Regex to only fetch MlModels with names matching the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`vertexAIType`** *(string)*: Service type. Must be one of: `['VertexAI']`. Default: `VertexAI`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
