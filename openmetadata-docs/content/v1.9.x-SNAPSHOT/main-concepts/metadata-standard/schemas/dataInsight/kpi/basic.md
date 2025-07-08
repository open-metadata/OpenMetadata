---
title: Basic KPI Schema | OpenMetadata Basic KPI
slug: /main-concepts/metadata-standard/schemas/datainsight/kpi/basic
---

# Basic

*This schema defines basic types that are used by other Kpi Definitions*

## Definitions

- **`kpiTargetType`** *(string)*: This enum defines the type of key Result. Must be one of: `["NUMBER", "PERCENTAGE"]`.
- **`kpiTarget`** *(object)*: This schema defines the parameter values that can be passed for a Kpi Parameter. Cannot contain additional properties.
  - **`name`** *(string, required)*: name of the parameter. Must match the parameter names in metrics of the chart this objective refers.
  - **`value`** *(string, required)*: value to be passed for the Parameters. These are input from Users. We capture this in string and convert during the runtime.
  - **`targetMet`** *(boolean)*: whether the target value was met or not.
- **`kpiResult`** *(object)*: Schema to capture kpi result. Cannot contain additional properties.
  - **`timestamp`**: Data one which result is updated. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
  - **`kpiFqn`**: KPI FQN. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
  - **`targetResult`** *(array, required)*: Metric and their corresponding current results.
    - **Items**: Refer to *[#/definitions/kpiTarget](#definitions/kpiTarget)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
