---
title: databaseServiceProfilerPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseserviceprofilerpipeline
---

# DatabaseServiceProfilerPipeline

*DatabaseService Profiler Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/profilerConfigType*. Default: `Profiler`.
- **`fqnFilterPattern`**: Regex to only fetch tables with FQN matching the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`generateSampleData`** *(boolean)*: Option to turn on/off generating sample data. Default: `True`.
## Definitions

- **`profilerConfigType`** *(string)*: Profiler Source Config Pipeline type. Must be one of: `['Profiler']`. Default: `Profiler`.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
