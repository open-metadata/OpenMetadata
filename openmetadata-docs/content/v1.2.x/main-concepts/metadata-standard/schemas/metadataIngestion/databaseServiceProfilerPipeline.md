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
- **`includeViews`** *(boolean)*: Optional configuration to turn off fetching metadata for views. Default: `True`.
- **`processPiiSensitive`** *(boolean)*: Optional configuration to automatically tag columns that might contain sensitive information. Default: `False`.
- **`confidence`** *(number)*: Set the Confidence value for which you want the column to be marked. Default: `80`.
- **`generateSampleData`** *(boolean)*: Option to turn on/off generating sample data. Default: `True`.
- **`profileSample`** *(number)*: Percentage of data or no. of rows we want to execute the profiler and tests on. Default: `None`.
- **`profileSampleType`**: Refer to *../entity/data/table.json#/definitions/profileSampleType*.
- **`threadCount`** *(number)*: Number of threads to use during metric computations. Default: `5`.
- **`timeoutSeconds`** *(integer)*: Profiler Timeout in Seconds. Default: `43200`.
## Definitions

- **`profilerConfigType`** *(string)*: Profiler Source Config Pipeline type. Must be one of: `['Profiler']`. Default: `Profiler`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
