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
- **`charts`** *(array)*: All the charts included in this Dashboard. Default: `None`.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`tags`** *(array)*: Tags for this dashboard. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owner`**: Owner of this dashboard. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the dashboard service where this dashboard is hosted in. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
