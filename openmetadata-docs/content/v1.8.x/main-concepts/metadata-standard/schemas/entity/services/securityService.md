---
title: Security Service | OpenMetadata Security Service
slug: /main-concepts/metadata-standard/schemas/entity/services/securityservice
collate: true
---

# Security Service

*This schema defines the Security Service entity, such as Apache Ranger.*

## Properties

- **`id`**: Unique identifier of this security service instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this security service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this security service.
- **`serviceType`**: Type of security service such as Ranger... Refer to *[#/definitions/securityServiceType](#definitions/securityServiceType)*.
- **`description`**: Description of a security service instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`connection`**: Refer to *[#/definitions/securityConnection](#definitions/securityConnection)*.
- **`pipelines`**: References to pipelines deployed for this security service to extract metadata etc.. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *[connections/testConnectionResult.json](#nnections/testConnectionResult.json)*.
- **`tags`** *(array)*: Tags for this security Service. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this security service. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`owners`**: Owners of this security service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.

## Definitions

- **`securityServiceType`** *(string)*: Type of security service. Must be one of: `["Ranger"]`.
- **`securityConnection`** *(object)*: Security service connection configuration. 