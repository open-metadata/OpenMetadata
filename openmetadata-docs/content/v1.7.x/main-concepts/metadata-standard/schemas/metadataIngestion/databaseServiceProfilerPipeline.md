---
title: databaseServiceProfilerPipeline | Official Documentation
description: Connect Databaseserviceprofilerpipeline to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/databaseserviceprofilerpipeline
---

# DatabaseServiceProfilerPipeline

*DatabaseService Profiler Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/profilerConfigType](#definitions/profilerConfigType)*. Default: `"Profiler"`.
- **`classificationFilterPattern`**: Regex to only compute metrics for table that matches the given tag, tiers, gloassary pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`schemaFilterPattern`**: Regex to only fetch tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`tableFilterPattern`**: Regex exclude tables or databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`databaseFilterPattern`**: Regex to only fetch databases that matches the pattern. Refer to *[../type/filterPattern.json#/definitions/filterPattern](#/type/filterPattern.json#/definitions/filterPattern)*.
- **`includeViews`** *(boolean)*: Optional configuration to turn off fetching metadata for views. Default: `false`.
- **`useFqnForFiltering`** *(boolean)*: Regex will be applied on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name). Default: `false`.
- **`computeMetrics`** *(boolean)*: Option to turn on/off computing profiler metrics. Default: `true`.
- **`computeTableMetrics`** *(boolean)*: Option to turn on/off table metric computation. If enabled, profiler will compute table level metrics. Default: `true`.
- **`computeColumnMetrics`** *(boolean)*: Option to turn on/off column metric computation. If enabled, profiler will compute column level metrics. Default: `true`.
- **`useStatistics`** *(boolean)*: Use system tables to extract metrics. Metrics that cannot be gathered from system tables will use the default methods. Using system tables can be faster but requires gathering statistics before running (for example using the ANALYZE procedure). More information can be found in the documentation: https://docs.openmetadata.org/latest/profler. Default: `false`.
- **`profileSampleType`**: Refer to *[../entity/data/table.json#/definitions/profileSampleType](#/entity/data/table.json#/definitions/profileSampleType)*.
- **`profileSample`** *(number)*: Percentage of data or no. of rows used to compute the profiler metrics and run data quality tests. Default: `null`.
- **`samplingMethodType`**: Refer to *[../entity/data/table.json#/definitions/samplingMethodType](#/entity/data/table.json#/definitions/samplingMethodType)*.
- **`threadCount`** *(number)*: Number of threads to use during metric computations. Default: `5`.
- **`timeoutSeconds`** *(integer)*: Profiler Timeout in Seconds. Default: `43200`.
## Definitions

- **`profilerConfigType`** *(string)*: Profiler Source Config Pipeline type. Must be one of: `["Profiler"]`. Default: `"Profiler"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
