---
title: createKpiRequest
slug: /main-concepts/metadata-standard/schemas/api/datainsight/kpi/createkpirequest
---

# CreateKpiRequest

*Schema corresponding to a Kpi.*

## Properties

- **`name`**: Name that identifies this Kpi. Refer to *../../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Kpi.
- **`description`**: Description of the Kpi. Refer to *../../../type/basic.json#/definitions/markdown*.
- **`owner`**: Owner of this Kpi. Refer to *../../../type/entityReference.json*.
- **`dataInsightChart`**: Fully qualified name of the Chart this kpi refers to. Refer to *../../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`startDate`**: Start Date for the KPIs. Refer to *../../../type/basic.json#/definitions/timestamp*.
- **`endDate`**: End Date for the KPIs. Refer to *../../../type/basic.json#/definitions/timestamp*.
- **`targetDefinition`** *(array)*: Metrics from the chart and the target to achieve the result.
  - **Items**: Refer to *../../../dataInsight/kpi/basic.json#/definitions/kpiTarget*.
- **`metricType`**: Refer to *../../../dataInsight/kpi/basic.json#/definitions/kpiTargetType*.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
