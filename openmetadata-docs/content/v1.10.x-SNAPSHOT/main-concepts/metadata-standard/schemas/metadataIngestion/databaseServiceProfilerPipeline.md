---
title: databaseServiceProfilerPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseserviceprofilerpipeline
---

# DatabaseServiceProfilerPipeline

*DatabaseService Profiler Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/profilerConfigType*. Default: `Profiler`.
- **`processingEngine`**: Refer to *#/definitions/processingEngine*.
- **`classificationFilterPattern`**: Regex to only compute metrics for table that matches the given tag, tiers, gloassary pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`includeViews`** *(boolean)*: Optional configuration to turn off fetching metadata for views. Default: `False`.
- **`useFqnForFiltering`** *(boolean)*: Regex will be applied on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name). Default: `False`.
- **`computeMetrics`** *(boolean)*: Option to turn on/off computing profiler metrics. Default: `True`.
- **`computeTableMetrics`** *(boolean)*: Option to turn on/off table metric computation. If enabled, profiler will compute table level metrics. Default: `True`.
- **`computeColumnMetrics`** *(boolean)*: Option to turn on/off column metric computation. If enabled, profiler will compute column level metrics. Default: `True`.
- **`useStatistics`** *(boolean)*: Use system tables to extract metrics. Metrics that cannot be gathered from system tables will use the default methods. Using system tables can be faster but requires gathering statistics before running (for example using the ANALYZE procedure). More information can be found in the documentation: https://docs.openmetadata.org/latest/profler. Default: `False`.
- **`profileSampleType`**: Refer to *../entity/data/table.json#/definitions/profileSampleType*.
- **`profileSample`** *(number)*: Percentage of data or no. of rows used to compute the profiler metrics and run data quality tests. Default: `None`.
- **`samplingMethodType`**: Refer to *../entity/data/table.json#/definitions/samplingMethodType*.
- **`randomizedSample`** *(boolean)*: Whether to randomize the sample data or not. Default: `True`.
- **`threadCount`** *(number)*: Number of threads to use during metric computations. Default: `5`.
- **`timeoutSeconds`** *(integer)*: Profiler Timeout in Seconds. Default: `43200`.
## Definitions

- **`profilerConfigType`** *(string)*: Profiler Source Config Pipeline type. Must be one of: `['Profiler']`. Default: `Profiler`.
- **`processingEngine`**: Processing Engine Configuration. If not provided, the Native Engine will be used by default. Default: `{'type': 'Native'}`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
