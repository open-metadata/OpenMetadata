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
- **`owner`**: Owner of this data model. Refer to *../../type/entityReference.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this data model. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`followers`**: Followers of this dashboard. Refer to *../../type/entityReferenceList.json*.
- **`service`**: Link to service where this data model is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this data model is hosted in. Refer to *../services/dashboardService.json#/definitions/dashboardServiceType*.
- **`dataModelType`**: Refer to *#/definitions/dataModelType*.
- **`sql`**: In case the Data Model is based on a SQL query. Refer to *../../type/basic.json#/definitions/sqlQuery*. Default: `None`.
- **`columns`** *(array)*: Columns from the data model. Default: `None`.
  - **Items**: Refer to *table.json#/definitions/column*.
- **`project`** *(string)*: Name of the project / workspace / collection in which the dataModel is contained.
- **`domain`**: Domain the Dashboard Data Model belongs to. When not set, the Dashboard model inherits the domain from the dashboard service it belongs to. Refer to *../../type/entityReference.json*.
- **`votes`**: Refer to *../../type/votes.json*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *../../type/lifeCycle.json*.
## Definitions

- **`dataModelType`** *(string)*: This schema defines the type used for describing different types of data models. Must be one of: `['TableauDataModel', 'SupersetDataModel', 'MetabaseDataModel', 'LookMlView', 'LookMlExplore', 'PowerBIDataModel', 'QlikSenseDataModel']`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
