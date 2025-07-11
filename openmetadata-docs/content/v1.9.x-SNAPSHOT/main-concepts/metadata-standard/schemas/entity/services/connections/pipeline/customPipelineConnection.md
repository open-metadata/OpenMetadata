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

- **`customPipelineType`** *(string)*: Custom pipeline service type. Must be one of: `["CustomPipeline"]`. Default: `"CustomPipeline"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
