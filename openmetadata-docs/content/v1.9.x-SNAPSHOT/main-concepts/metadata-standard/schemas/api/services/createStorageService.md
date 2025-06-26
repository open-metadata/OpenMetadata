---
title: Create Storage Service | OpenMetadata Storage Service
slug: /main-concepts/metadata-standard/schemas/api/services/createstorageservice
---

# CreateStorageServiceRequest

*Create Storage Service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this storage service. It could be title or label from the source services.
- **`description`**: Description of storage service entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/storageService.json#/definitions/storageServiceType](#/../entity/services/storageService.json#/definitions/storageServiceType)*.
- **`connection`**: Refer to *[../../entity/services/storageService.json#/definitions/storageConnection](#/../entity/services/storageService.json#/definitions/storageConnection)*.
- **`tags`** *(array)*: Tags for this Object Store Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this object store service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Storage Service belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
