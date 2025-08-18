---
title: dataInsightChart
slug: /main-concepts/metadata-standard/schemas/datainsight/datainsightchart
---

# DataInsightChart

*DataInsightChart represents the definition of a chart with its parameters*

## Properties

- **`id`**: Unique identifier of this table instance. Refer to *../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this data insight chart. Refer to *../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this data insight chart.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the data insight chart. Refer to *../type/basic.json#/definitions/markdown*.
- **`dataIndexType`**: Refer to *#/definitions/dataReportIndex*.
- **`dimensions`** *(array)*
  - **Items**: Refer to *#/definitions/chartParameterValues*.
- **`metrics`** *(array)*
  - **Items**: Refer to *#/definitions/chartParameterValues*.
- **`version`**: Metadata version of the entity. Refer to *../type/entityHistory.json#/definitions/entityVersion*.
- **`owners`**: Owners of this Pipeline. Refer to *../type/entityReferenceList.json*. Default: `None`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domains`**: Domains the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *../type/entityReferenceList.json*.
## Definitions

- **`chartParameterValues`** *(object)*: This schema defines the parameter values for a chart.
  - **`name`** *(string)*: name of the parameter.
  - **`displayName`** *(string)*: Display Name that identifies this parameter name.
  - **`chartDataType`** *(string)*: Data type of the parameter (int, date etc.). Must be one of: `['NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TIMESTAMP', 'TIME', 'DATE', 'DATETIME', 'ARRAY', 'MAP', 'SET', 'STRING', 'BOOLEAN', 'PERCENTAGE']`.
- **`dataReportIndex`** *(string)*: Index where data are stored. Must be one of: `['entity_report_data_index', 'web_analytic_entity_view_report_data_index', 'web_analytic_user_activity_report_data_index', 'raw_cost_analysis_report_data_index', 'aggregated_cost_analysis_report_data_index']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
