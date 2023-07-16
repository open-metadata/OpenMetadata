---
title: customPipelineConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/custompipelineconnection
---

# CustomPipelineConnection

*Custom Pipeline Service connection to build a source that is not supported by OpenMetadata yet.*

## Properties

- **`type`**: Custom pipeline service type. Refer to *[#/definitions/customPipelineType](#definitions/customPipelineType)*. Default: `"CustomPipeline"`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to instantiated by the ingestion workflow.
- **`connectionOptions`**: Refer to *[../connectionBasicType.json#/definitions/connectionOptions](#/connectionBasicType.json#/definitions/connectionOptions)*.
## Definitions

- <a id="definitions/customPipelineType"></a>**`customPipelineType`** *(string)*: Custom pipeline service type. Must be one of: `["CustomPipeline"]`. Default: `"CustomPipeline"`.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
