---
title: sageMakerConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/mlmodel/sagemakerconnection
---

# SageMakerConnection

*SageMaker Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/sageMakerType*. Default: `SageMaker`.
- **`awsConfig`**: Refer to *../../../../security/credentials/awsCredentials.json*.
- **`mlModelFilterPattern`**: Regex to only fetch MlModels with names matching the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`sageMakerType`** *(string)*: Service type. Must be one of: `['SageMaker']`. Default: `SageMaker`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
