---
title: createDashboardService
slug: /main-concepts/metadata-standard/schemas/api/services/createdashboardservice
---

# CreateDashboardServiceRequest

*Create Dashboard service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this dashboard service.
- **`description`**: Description of dashboard service entity. Refer to *../../type/basic.json#/definitions/markdown*.
- **`serviceType`**: Refer to *../../entity/services/dashboardService.json#/definitions/dashboardServiceType*.
- **`connection`**: Refer to *../../entity/services/dashboardService.json#/definitions/dashboardConnection*.
- **`tags`** *(array)*: Tags for this Dashboard Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this dashboard service. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Dashboard Service belongs to.
  - **Items** *(string)*
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
