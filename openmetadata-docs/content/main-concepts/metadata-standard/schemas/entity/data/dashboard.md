---
title: dashboard
slug: /main-concepts/metadata-standard/schemas/entity/data/dashboard
---

# Dashboard

*This schema defines the Dashboard entity. Dashboards are computed from data and visually present data, metrics, and KPIs. They are updated in real-time and allow interactive data exploration.*

## Properties

- **`id`**: Unique identifier that identifies a dashboard instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this dashboard. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Dashboard. It could be title or label from the source services.
- **`fullyQualifiedName`**: A unique name that identifies a dashboard in the format 'ServiceName.DashboardName'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`**: Description of the dashboard, what it is, and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`dashboardUrl`** *(string)*: Dashboard URL suffix from its service.
- **`charts`** *(array)*: All the charts included in this Dashboard. Default: `None`.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`owner`**: Owner of this dashboard. Refer to *../../type/entityReference.json*.
- **`followers`**: Followers of this dashboard. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`tags`** *(array)*: Tags for this dashboard. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`service`**: Link to service where this dashboard is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this dashboard is hosted in. Refer to *../services/dashboardService.json#/definitions/dashboardServiceType*.
- **`usageSummary`**: Latest usage information for this database. Refer to *../../type/usageDetails.json*. Default: `None`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
