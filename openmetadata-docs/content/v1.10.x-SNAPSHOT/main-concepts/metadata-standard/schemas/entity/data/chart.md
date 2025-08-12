---
title: chart
slug: /main-concepts/metadata-standard/schemas/entity/data/chart
---

# Chart

*A `Chart` presents data visually. Charts can be part of `Dashboards`.*

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
- **`sourceUrl`**: Chart URL suffix from its service. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this chart. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this chart. Refer to *../../type/entityReferenceList.json*.
- **`tags`** *(array)*: Tags for this chart. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`service`**: Link to service where this dashboard is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this chart is hosted in. Refer to *../services/dashboardService.json#/definitions/dashboardServiceType*.
- **`usageSummary`**: Latest usage information for this chart. Refer to *../../type/usageDetails.json*. Default: `None`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domains`**: Domains the Chart belongs to. The Chart inherits domain from the dashboard service it belongs to. Refer to *../../type/entityReferenceList.json*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *../../type/lifeCycle.json*.
- **`certification`**: Refer to *../../type/assetCertification.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`dashboards`**: All the dashboards containing this chart. Refer to *../../type/entityReferenceList.json*. Default: `None`.
## Definitions

- **`chartType`** *(string)*: This schema defines the type used for describing different types of charts. Must be one of: `['Line', 'Table', 'Bar', 'Area', 'Pie', 'Histogram', 'Scatter', 'Text', 'BoxPlot', 'Gauge', 'Map', 'Graph', 'Heatmap', 'Timeline', 'Other']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
