---
title: createObjectStoreService
slug: /main-concepts/metadata-standard/schemas/api/services/createobjectstoreservice
---

# CreateObjectStoreServiceRequest

*Create Object Store service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this messaging service. It could be title or label from the source services.
- **`description`**: Description of messaging service entity. Refer to *../../type/basic.json#/definitions/markdown*.
- **`serviceType`**: Refer to *../../entity/services/objectstoreService.json#/definitions/objectStoreServiceType*.
- **`connection`**: Refer to *../../entity/services/objectstoreService.json#/definitions/objectStoreConnection*.
- **`tags`** *(array)*: Tags for this Object Store Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owner`**: Owner of this object store service. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
