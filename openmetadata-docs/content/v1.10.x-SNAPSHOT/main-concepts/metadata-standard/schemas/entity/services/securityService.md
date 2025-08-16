---
title: securityService
slug: /main-concepts/metadata-standard/schemas/entity/services/securityservice
---

# Security Service

*This schema defines the Security Service entity, such as Apache Ranger.*

## Properties

- **`id`**: Unique identifier of this security service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this security service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`serviceType`**: Type of security service such as Apache Ranger... Refer to *#/definitions/securityServiceType*.
- **`description`** *(string)*: Description of a security service instance.
- **`displayName`** *(string)*: Display Name that identifies this security service. It could be title or label from the source services.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *connections/testConnectionResult.json*.
- **`tags`** *(array)*: Tags for this Security Service. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`connection`**: Refer to *#/definitions/securityConnection*.
- **`pipelines`**: References to pipelines deployed for this security service to extract metadata, usage, lineage etc.. Refer to *../../type/entityReferenceList.json*.
- **`owners`**: Owners of this security service. Refer to *../../type/entityReferenceList.json*.
- **`href`**: Link to the resource corresponding to this security service. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`domains`**: Domains the security service belongs to. Refer to *../../type/entityReferenceList.json*.
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.
## Definitions

- **`securityServiceType`** *(string)*: Type of security service - Apache Ranger, etc. Must be one of: `['Ranger']`.
- **`securityConnection`** *(object)*: Security Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
