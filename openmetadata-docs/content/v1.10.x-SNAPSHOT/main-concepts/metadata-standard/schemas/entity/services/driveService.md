---
title: driveService
slug: /main-concepts/metadata-standard/schemas/entity/services/driveservice
---

# Drive Service

*This schema defines the Drive Service entity, such as Google Drive.*

## Properties

- **`id`**: Unique identifier of this drive service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this drive service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this drive service.
- **`serviceType`**: Type of drive service such as Google Drive... Refer to *#/definitions/driveServiceType*.
- **`description`**: Description of a drive service instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`connection`**: Refer to *#/definitions/driveConnection*.
- **`pipelines`**: References to pipelines deployed for this drive service to extract metadata, usage, lineage etc.. Refer to *../../type/entityReferenceList.json*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *connections/testConnectionResult.json*.
- **`tags`** *(array)*: Tags for this drive Service. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this drive service. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this drive service. Refer to *../../type/entityReferenceList.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`domains`**: Domains the Drive service belongs to. Refer to *../../type/entityReferenceList.json*.
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.
## Definitions

- **`driveServiceType`** *(string)*: Type of drive service such as Google Drive... Must be one of: `['GoogleDrive', 'SharePoint', 'CustomDrive']`.
- **`driveConnection`** *(object)*: Drive Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
