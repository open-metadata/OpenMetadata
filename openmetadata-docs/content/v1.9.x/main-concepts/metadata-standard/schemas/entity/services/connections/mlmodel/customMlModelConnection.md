---
title: Custommlmodelconnection | Official Documentation
description: Define a schema for connecting to custom ML model platforms, supporting ingestion of model lifecycle and metadata.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/mlmodel/custommlmodelconnection
---

# CustomMlModelConnection

*Custom MlModel Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom Ml model service type. Refer to *[#/definitions/customMlModelType](#definitions/customMlModelType)*. Default: `"CustomMlModel"`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
## Definitions

- **`customMlModelType`** *(string)*: Custom Ml model service type. Must be one of: `["CustomMlModel"]`. Default: `"CustomMlModel"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
