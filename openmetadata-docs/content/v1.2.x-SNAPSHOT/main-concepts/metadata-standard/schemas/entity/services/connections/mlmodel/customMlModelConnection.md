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
## Definitions

- **`customMlModelType`** *(string)*: Custom Ml model service type. Must be one of: `['CustomMlModel']`. Default: `CustomMlModel`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
