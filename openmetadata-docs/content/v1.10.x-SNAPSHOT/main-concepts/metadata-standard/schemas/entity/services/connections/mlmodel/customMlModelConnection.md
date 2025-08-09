---
title: customMlModelConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/mlmodel/custommlmodelconnection
---

# CustomMlModelConnection

*Custom MlModel Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom Ml model service type. Refer to *#/definitions/customMlModelType*. Default: `CustomMlModel`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`mlModelFilterPattern`**: Regex to only fetch MlModels with names matching the pattern. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`customMlModelType`** *(string)*: Custom Ml model service type. Must be one of: `['CustomMlModel']`. Default: `CustomMlModel`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
