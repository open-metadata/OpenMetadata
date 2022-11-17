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
- **`dataInsightChart`**: Chart this kpi refers to. Refer to *../../../type/entityReference.json*.
- **`startDate`**: Start Date for the KPIs. Refer to *../../../type/basic.json#/definitions/timestamp*.
- **`endDate`**: End Date for the KPIs. Refer to *../../../type/basic.json#/definitions/timestamp*.
- **`targetDefinition`** *(array)*: Metrics from the chart and the target to achieve the result.
  - **Items**: Refer to *../../../dataInsight/kpi/basic.json#/definitions/kpiTarget*.
- **`metricType`**: Refer to *../../../dataInsight/kpi/basic.json#/definitions/kpiTargetType*.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
