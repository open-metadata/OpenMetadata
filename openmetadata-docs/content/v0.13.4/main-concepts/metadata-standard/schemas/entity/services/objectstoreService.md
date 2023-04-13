---
title: objectstoreService
slug: /main-concepts/metadata-standard/schemas/entity/services/objectstoreservice
---

# Object Store Service

*This schema defines the Object Store Service entity, such as S3, GCS or AZURE.*

## Properties

- **`id`**: Unique identifier of this object store service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this object store service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this object store service.
- **`serviceType`**: Type of object store service such as S3, GCS, AZURE... Refer to *#/definitions/objectStoreServiceType*.
- **`description`**: Description of a object store service instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`connection`**: Refer to *#/definitions/objectStoreConnection*.
- **`pipelines`**: References to pipelines deployed for this object store service to extract metadata, usage, lineage etc.. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *connections/testConnectionResult.json*.
- **`tags`** *(array)*: Tags for this Object Store Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this object store service. Refer to *../../type/basic.json#/definitions/href*.
- **`owner`**: Owner of this object store service. Refer to *../../type/entityReference.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`objectStoreServiceType`** *(string)*: Type of object store service such as S3, GFS, AZURE... Must be one of: `['S3']`.
- **`objectStoreConnection`** *(object)*: Object Store Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
