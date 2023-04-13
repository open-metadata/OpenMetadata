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
- **`owner`**: Owner of this dashboard service. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
