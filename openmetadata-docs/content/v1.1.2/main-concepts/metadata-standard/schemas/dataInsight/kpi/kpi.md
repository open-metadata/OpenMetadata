---
title: kpi
slug: /main-concepts/metadata-standard/schemas/datainsight/kpi/kpi
---

# Kpi

*A `KIP` entity defines a metric and a target.*

## Properties

- **`id`**: Unique identifier of this KPI Definition instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this KPI Definition. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this KPI Definition.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the KpiObjective. Refer to *../../type/basic.json#/definitions/markdown*.
- **`metricType`**: Refer to *./basic.json#/definitions/kpiTargetType*.
- **`dataInsightChart`**: Data Insight Chart Referred by this Kpi Objective. Refer to *../../type/entityReference.json*.
- **`targetDefinition`** *(array)*: Metrics from the chart and the target to achieve the result.
  - **Items**: Refer to *./basic.json#/definitions/kpiTarget*.
- **`kpiResult`**: Result of the Kpi. Refer to *./basic.json#/definitions/kpiResult*.
- **`startDate`**: Start Date for the KPIs. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`endDate`**: End Date for the KPIs. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`owner`**: Owner of this KPI definition. Refer to *../../type/entityReference.json*. Default: `None`.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
