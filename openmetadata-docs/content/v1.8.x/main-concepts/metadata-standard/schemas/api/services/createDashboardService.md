---
title: createDashboardService | Official Documentation
description: Create a dashboard service entity to store metadata for dashboards and related visualization tools.
slug: /main-concepts/metadata-standard/schemas/api/services/createdashboardservice
---

# CreateDashboardServiceRequest

*Create Dashboard service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this dashboard service.
- **`description`**: Description of dashboard service entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/dashboardService.json#/definitions/dashboardServiceType](#/../entity/services/dashboardService.json#/definitions/dashboardServiceType)*.
- **`connection`**: Refer to *[../../entity/services/dashboardService.json#/definitions/dashboardConnection](#/../entity/services/dashboardService.json#/definitions/dashboardConnection)*.
- **`tags`** *(array)*: Tags for this Dashboard Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this dashboard service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Dashboard Service belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
