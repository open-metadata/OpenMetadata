---
title: createDashboardDataModel
slug: /main-concepts/metadata-standard/schemas/api/data/createdashboarddatamodel
---

# CreateDashboardDataModelRequest

*Create Dashboard Data Model entity request.*

## Properties

- **`name`**: Name that identifies this data model. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this data model. It could be title or label from the source services.
- **`description`**: Description of the data model instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`tags`** *(array)*: Tags for this data model. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`owners`**: Owners of this data model. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`service`**: Link to the data model service where this data model is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`serviceType`**: Service type where this data model is hosted in. Refer to *../../entity/services/dashboardService.json#/definitions/dashboardServiceType*.
- **`dataModelType`**: Refer to *../../entity/data/dashboardDataModel.json#/definitions/dataModelType*.
- **`sql`**: In case the Data Model is based on a SQL query. Refer to *../../type/basic.json#/definitions/sqlQuery*. Default: `None`.
- **`columns`** *(array)*: Columns from the data model. Default: `None`.
  - **Items**: Refer to *../../entity/data/table.json#/definitions/column*.
- **`project`** *(string)*: Name of the project / workspace / collection in which the dataModel is contained.
- **`domains`** *(array)*: Fully qualified names of the domains the Dashboard Data Model belongs to.
  - **Items** *(string)*
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
