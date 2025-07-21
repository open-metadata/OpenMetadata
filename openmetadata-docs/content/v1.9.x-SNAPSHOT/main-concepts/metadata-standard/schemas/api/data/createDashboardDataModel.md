---
title: createDashboardDataModel
slug: /main-concepts/metadata-standard/schemas/api/data/createdashboarddatamodel
---

# CreateDashboardDataModelRequest

*Create Dashboard Data Model entity request.*

## Properties

- **`name`**: Name that identifies this data model. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this data model. It could be title or label from the source services.
- **`description`**: Description of the data model instance. What it has and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`tags`** *(array)*: Tags for this data model. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`owners`**: Owners of this data model. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`service`**: Link to the data model service where this data model is hosted in. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`serviceType`**: Service type where this data model is hosted in. Refer to *[../../entity/services/dashboardService.json#/definitions/dashboardServiceType](#/../entity/services/dashboardService.json#/definitions/dashboardServiceType)*.
- **`dataModelType`**: Refer to *[../../entity/data/dashboardDataModel.json#/definitions/dataModelType](#/../entity/data/dashboardDataModel.json#/definitions/dataModelType)*.
- **`sql`**: In case the Data Model is based on a SQL query. Refer to *[../../type/basic.json#/definitions/sqlQuery](#/../type/basic.json#/definitions/sqlQuery)*. Default: `null`.
- **`columns`** *(array)*: Columns from the data model. Default: `null`.
  - **Items**: Refer to *[../../entity/data/table.json#/definitions/column](#/../entity/data/table.json#/definitions/column)*.
- **`project`** *(string)*: Name of the project / workspace / collection in which the dataModel is contained.
- **`domain`** *(string)*: Fully qualified name of the domain the Dashboard Data Model belongs to.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
