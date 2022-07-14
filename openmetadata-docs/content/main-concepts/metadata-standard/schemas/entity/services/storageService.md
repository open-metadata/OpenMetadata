---
title: storageService
slug: /main-concepts/metadata-standard/schemas/entity/services/storageservice
---

# Storage Service

*This schema defines the Storage Service entity, such as S3, GCS, HDFS.*

## Properties

- **`id`**: Unique identifier of this storage service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this storage service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this storage service.
- **`serviceType`**: Type of storage service such as S3, GCS, HDFS... Refer to *../../type/storage.json#/definitions/storageServiceType*.
- **`description`**: Description of a storage service instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this storage service. Refer to *../../type/basic.json#/definitions/href*.
- **`owner`**: Owner of this storage service. Refer to *../../type/entityReference.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
