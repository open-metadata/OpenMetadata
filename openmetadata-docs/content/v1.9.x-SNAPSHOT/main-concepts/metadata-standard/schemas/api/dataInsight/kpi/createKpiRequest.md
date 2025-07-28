---
title: Create KPI Request | OpenMetadata KPI Request API
description: Structure KPI creation request metadata including entity reference, formula, target, and aggregation.
slug: /main-concepts/metadata-standard/schemas/api/datainsight/kpi/createkpirequest
---

# CreateKpiRequest

*Schema corresponding to a Kpi.*

## Properties

- **`name`**: Name that identifies this Kpi. Refer to *[../../../type/basic.json#/definitions/entityName](#/../../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Kpi.
- **`description`**: Description of the Kpi. Refer to *[../../../type/basic.json#/definitions/markdown](#/../../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owner of this Kpi. Refer to *[../../../type/entityReferenceList.json](#/../../type/entityReferenceList.json)*. Default: `null`.
- **`dataInsightChart`** *(string)*: Fully qualified name of the Chart this kpi refers to. Must be one of: `["percentage_of_data_asset_with_description_kpi", "percentage_of_data_asset_with_owner_kpi", "number_of_data_asset_with_description_kpi", "number_of_data_asset_with_owner_kpi"]`.
- **`startDate`**: Start Date for the KPIs. Refer to *[../../../type/basic.json#/definitions/timestamp](#/../../type/basic.json#/definitions/timestamp)*.
- **`endDate`**: End Date for the KPIs. Refer to *[../../../type/basic.json#/definitions/timestamp](#/../../type/basic.json#/definitions/timestamp)*.
- **`targetValue`** *(number)*: Metrics from the chart and the target to achieve the result.
- **`metricType`**: Refer to *[../../../dataInsight/kpi/basic.json#/definitions/kpiTargetType](#/../../dataInsight/kpi/basic.json#/definitions/kpiTargetType)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
