---
title: basic
slug: /main-concepts/metadata-standard/schemas/datainsight/kpi/basic
---

# Basic

*This schema defines basic types that are used by other Kpi Definitions*

## Definitions

- <a id="definitions/kpiTargetType"></a>**`kpiTargetType`** *(string)*: This enum defines the type of key Result. Must be one of: `["NUMBER", "PERCENTAGE"]`.
- <a id="definitions/kpiTarget"></a>**`kpiTarget`** *(object)*: This schema defines the parameter values that can be passed for a Kpi Parameter. Cannot contain additional properties.
  - **`name`** *(string, required)*: name of the parameter. Must match the parameter names in metrics of the chart this objective refers.
  - **`value`** *(string, required)*: value to be passed for the Parameters. These are input from Users. We capture this in string and convert during the runtime.
  - **`targetMet`** *(boolean)*: whether the target value was met or not.
- <a id="definitions/kpiResult"></a>**`kpiResult`** *(object)*: Schema to capture kpi result. Cannot contain additional properties.
  - **`timestamp`**: Data one which result is updated. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
  - **`kpiFqn`**: KPI FQN. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
  - **`targetResult`** *(array, required)*: Metric and their corresponding current results.
    - **Items**: Refer to *[#/definitions/kpiTarget](#definitions/kpiTarget)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
