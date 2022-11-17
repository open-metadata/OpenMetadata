---
title: databaseServiceProfilerPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseserviceprofilerpipeline
---

# DatabaseServiceProfilerPipeline

*DatabaseService Profiler Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/profilerConfigType*. Default: `Profiler`.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`generateSampleData`** *(boolean)*: Option to turn on/off generating sample data. Default: `True`.
- **`profileSample`** *(number)*: Percentage of data used to execute the profiler for the whole workflow. This percentage will be applied to all tables in the workflow. Represented in the range (0, 100]. Maximum: `100`. Default: `None`.
- **`threadCount`** *(number)*: Number of threads to use during metric computations. Default: `5`.
## Definitions

- **`profilerConfigType`** *(string)*: Profiler Source Config Pipeline type. Must be one of: `['Profiler']`. Default: `Profiler`.


Documentation file automatically generated at 2022-09-18 19:21:45.413954.
