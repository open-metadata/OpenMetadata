---
title: chart
slug: /main-concepts/metadata-standard/schemas/schema/entity/data
---

# Chart

*This schema defines the Chart entity. Charts are built using tables or sql queries by analyzing the data. Charts can be part of Dashboard.*

## Properties

- **`id`**: Unique identifier that identifies a chart instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this Chart. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Chart. It could be title or label from the source services.
- **`fullyQualifiedName`**: A unique name that identifies a dashboard in the format 'ServiceName.ChartName'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the dashboard, what it is, and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`chartType`**: Refer to *#/definitions/chartType*.
- **`chartUrl`** *(string)*: Chart URL suffix from its service.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`owner`**: Owner of this dashboard. Refer to *../../type/entityReference.json*.
- **`tables`**: Link to table used in this chart. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`followers`**: Followers of this chart. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`tags`** *(array)*: Tags for this chart. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`service`**: Link to service where this dashboard is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this chart is hosted in. Refer to *../services/dashboardService.json#/definitions/dashboardServiceType*.
- **`usageSummary`**: Latest usage information for this database. Refer to *../../type/usageDetails.json*. Default: `None`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`chartType`** *(string)*: This schema defines the type used for describing different types of charts. Must be one of: `['Line', 'Table', 'Bar', 'Area', 'Pie', 'Histogram', 'Scatter', 'Text', 'BoxPlot', 'Other']`.


Documentation file automatically generated at 2022-07-13 10:27:46.766157.
