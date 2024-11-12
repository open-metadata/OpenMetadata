---
title: storageService
slug: /main-concepts/metadata-standard/schemas/entity/services/storageservice
---

# Storage Service

*This schema defines the Storage Service entity, such as S3, GCS or AZURE.*

## Properties

- **`id`**: Unique identifier of this storage service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this storage service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this storage service.
- **`serviceType`**: Type of storage service such as S3, GCS, AZURE... Refer to *#/definitions/storageServiceType*.
- **`description`**: Description of a storage service instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`connection`**: Refer to *#/definitions/storageConnection*.
- **`pipelines`**: References to pipelines deployed for this storage service to extract metadata, usage, lineage etc.. Refer to *../../type/entityReferenceList.json*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *connections/testConnectionResult.json*.
- **`tags`** *(array)*: Tags for this storage Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this storage service. Refer to *../../type/basic.json#/definitions/href*.
- **`owner`**: Owner of this storage service. Refer to *../../type/entityReference.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domain`**: Domain the Storage service belongs to. Refer to *../../type/entityReference.json*.
## Definitions

- **`storageServiceType`** *(string)*: Type of storage service such as S3, GFS, AZURE... Must be one of: `['S3', 'ADLS', 'CustomStorage']`.
- **`storageConnection`** *(object)*: storage Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
