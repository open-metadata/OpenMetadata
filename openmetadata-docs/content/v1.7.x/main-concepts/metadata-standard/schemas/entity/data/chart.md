---
title: Chart Schema | OpenMetadata Chart Schema and API Guide
description: Connect Chart to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/entity/data/chart
---

# Chart

*A `Chart` presents data visually. Charts can be part of `Dashboards`.*

## Properties

- **`id`**: Unique identifier that identifies a chart instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this Chart. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Chart. It could be title or label from the source services.
- **`fullyQualifiedName`**: A unique name that identifies a dashboard in the format 'ServiceName.ChartName'. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`description`**: Description of the dashboard, what it is, and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`chartType`**: Refer to *[#/definitions/chartType](#definitions/chartType)*.
- **`sourceUrl`**: Chart URL suffix from its service. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`owners`**: Owners of this chart. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`followers`**: Followers of this chart. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`tags`** *(array)*: Tags for this chart. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`service`**: Link to service where this dashboard is hosted in. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`serviceType`**: Service type where this chart is hosted in. Refer to *[../services/dashboardService.json#/definitions/dashboardServiceType](#/services/dashboardService.json#/definitions/dashboardServiceType)*.
- **`usageSummary`**: Latest usage information for this chart. Refer to *[../../type/usageDetails.json](#/../type/usageDetails.json)*. Default: `null`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`domain`**: Domain the Chart belongs to. The Chart inherits domain from the dashboard service it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`votes`**: Votes on the entity. Refer to *[../../type/votes.json](#/../type/votes.json)*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`certification`**: Refer to *[../../type/assetCertification.json](#/../type/assetCertification.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`dashboards`**: All the dashboards containing this chart. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
## Definitions

- **`chartType`** *(string)*: This schema defines the type used for describing different types of charts. Must be one of: `["Line", "Table", "Bar", "Area", "Pie", "Histogram", "Scatter", "Text", "BoxPlot", "Other"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
