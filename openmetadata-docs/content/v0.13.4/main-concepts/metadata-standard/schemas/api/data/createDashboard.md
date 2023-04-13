---
title: createDashboard
slug: /main-concepts/metadata-standard/schemas/api/data/createdashboard
---

# CreateDashboardRequest

*Create Dashboard entity request*

## Properties

- **`name`**: Name that identifies this dashboard. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Dashboard. It could be title or label from the source services.
- **`description`**: Description of the database instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`dashboardUrl`** *(string)*: Dashboard URL suffix from its service.
- **`charts`** *(array)*: List of fully qualified name of charts included in this Dashboard. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`dataModels`** *(array)*: List of fully qualified name of data models included in this Dashboard. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`tags`** *(array)*: Tags for this dashboard. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owner`**: Owner of this dashboard. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the dashboard service fully qualified name where this dashboard is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
