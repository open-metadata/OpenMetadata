---
title: createStorageService
slug: /main-concepts/metadata-standard/schemas/api/services/createstorageservice
---

# CreateStorageServiceRequest

*Create Storage Service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this storage service. It could be title or label from the source services.
- **`description`**: Description of storage service entity. Refer to *../../type/basic.json#/definitions/markdown*.
- **`serviceType`**: Refer to *../../entity/services/storageService.json#/definitions/storageServiceType*.
- **`connection`**: Refer to *../../entity/services/storageService.json#/definitions/storageConnection*.
- **`tags`** *(array)*: Tags for this Object Store Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owner`**: Owner of this object store service. Refer to *../../type/entityReference.json*.
- **`domain`** *(string)*: Fully qualified name of the domain the Storage Service belongs to.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
