---
title: profilerConfiguration
slug: /main-concepts/metadata-standard/schemas/configuration/profilerconfiguration
---

# ProfilerConfiguration

*This schema defines the profiler configuration. It is used to configure globally the metrics to compute for specific data types.*

## Properties

- **`metricConfiguration`** *(array)*
  - **Items**: Refer to *#/definitions/metricConfigurationDefinition*.
## Definitions

- **`metricType`** *(string)*: This schema defines all possible metric types in OpenMetadata. Must be one of: `['mean', 'valuesCount', 'countInSet', 'columnCount', 'distinctCount', 'distinctProportion', 'iLikeCount', 'likeCount', 'notLikeCount', 'regexCount', 'notRegexCount', 'max', 'maxLength', 'min', 'minLength', 'nullCount', 'rowCount', 'stddev', 'sum', 'uniqueCount', 'uniqueProportion', 'columnNames', 'duplicateCount', 'iLikeRatio', 'likeRatio', 'nullProportion', 'interQuartileRange', 'nonParametricSkew', 'median', 'firstQuartile', 'thirdQuartile', 'system', 'histogram']`.
- **`metricConfigurationDefinition`** *(object)*: This schema defines the parameters that can be passed for a Test Case. Cannot contain additional properties.
  - **`dataType`**: Refer to *../entity/data/table.json#/definitions/dataType*.
  - **`metrics`** *(array)*
    - **Items**: Refer to *#/definitions/metricType*.
  - **`disabled`** *(boolean)*: If true, the metric will not be computed for the data type. Default: `False`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
