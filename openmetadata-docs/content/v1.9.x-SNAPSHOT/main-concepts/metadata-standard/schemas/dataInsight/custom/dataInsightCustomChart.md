---
title: dataInsightCustomChart
slug: /main-concepts/metadata-standard/schemas/datainsight/custom/datainsightcustomchart
---

# Chart

*DI Chart Entity*

## Properties

- **`id`**: Unique identifier of this table instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this data insight chart. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name the data insight chart.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`description`**: Description of the data insight chart. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`chartType`** *(string)*: Type of chart, used for UI to render the chart. Must be one of: `["LineChart", "AreaChart", "BarChart", "SummaryCard"]`.
- **`chartDetails`**
  - **One of**
    - : Refer to *[lineChart.json](#neChart.json)*.
    - : Refer to *[summaryCard.json](#mmaryCard.json)*.
- **`isSystemChart`** *(boolean)*: Flag to indicate if the chart is system generated or user created. Default: `false`.
- **`owner`**: Owner of this chart. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`dashboard`**: Dashboard where this chart is displayed. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- **`function`** *(string)*: aggregation function for chart. Must be one of: `["count", "sum", "avg", "min", "max", "unique"]`.
- **`kpiDetails`** *(object)*: KPI details for the data insight chart.
  - **`startDate`** *(string)*: Start Date of KPI.
  - **`endDate`** *(string)*: End Date of KPI.
  - **`target`** *(number)*: Target value of KPI.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
