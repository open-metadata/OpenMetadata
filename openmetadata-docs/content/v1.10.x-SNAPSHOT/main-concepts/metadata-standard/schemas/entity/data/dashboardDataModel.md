---
title: dashboardDataModel
slug: /main-concepts/metadata-standard/schemas/entity/data/dashboarddatamodel
---

# DashboardDataModel

*Dashboard Data Model entity definition. Data models are the schemas used to build dashboards, charts, or other data assets.*

## Properties

- **`id`**: Unique identifier of this data model instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of a data model. Expected to be unique within a Dashboard. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this data model. It could be title or label from the source.
- **`fullyQualifiedName`**: Fully qualified name of a data model in the form `serviceName.dashboardName.datamodel.datamodelName`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of a data model. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to this data model entity. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this data model. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`tags`** *(array)*: Tags for this data model. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`followers`**: Followers of this dashboard. Refer to *../../type/entityReferenceList.json*.
- **`service`**: Link to service where this data model is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this data model is hosted in. Refer to *../services/dashboardService.json#/definitions/dashboardServiceType*.
- **`dataModelType`**: Refer to *#/definitions/dataModelType*.
- **`sql`**: In case the Data Model is based on a SQL query. Refer to *../../type/basic.json#/definitions/sqlQuery*. Default: `None`.
- **`columns`** *(array)*: Columns from the data model. Default: `None`.
  - **Items**: Refer to *table.json#/definitions/column*.
- **`project`** *(string)*: Name of the project / workspace / collection in which the dataModel is contained.
- **`domains`**: Domains the Dashboard Data Model belongs to. When not set, the Dashboard model inherits the domain from the dashboard service it belongs to. Refer to *../../type/entityReferenceList.json*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *../../type/lifeCycle.json*.
- **`certification`**: Refer to *../../type/assetCertification.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
## Definitions

- **`dataModelType`** *(string)*: This schema defines the type used for describing different types of data models. Must be one of: `['TableauDataModel', 'TableauPublishedDatasource', 'TableauEmbeddedDatasource', 'SupersetDataModel', 'MetabaseDataModel', 'LookMlView', 'LookMlExplore', 'PowerBIDataModel', 'QlikDataModel', 'QuickSightDataModel', 'SigmaDataModel', 'PowerBIDataFlow', 'MicroStrategyDataset', 'ThoughtSpotDataModel']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
