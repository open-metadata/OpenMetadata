---
title: apiService
slug: /main-concepts/metadata-standard/schemas/entity/services/apiservice
---

# Api Service

*This schema defines the API Service entity, to capture metadata from any REST API Services.*

## Properties

- **`id`**: Unique identifier of this API service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this API service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this API service.
- **`serviceType`**: Type of API service such as REST, WEBHOOK.. Refer to *#/definitions/apiServiceType*.
- **`description`**: Description of a API service instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`connection`**: Refer to *#/definitions/apiConnection*.
- **`pipelines`**: References to pipelines deployed for this API service to extract metadata, usage, lineage etc.. Refer to *../../type/entityReferenceList.json*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *connections/testConnectionResult.json*.
- **`tags`** *(array)*: Tags for this API Service. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this API service. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this API service. Refer to *../../type/entityReferenceList.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`domains`**: Domains the API service belongs to. Refer to *../../type/entityReferenceList.json*.
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.
## Definitions

- **`apiServiceType`** *(string)*: Type of api service such as REST, Webhook,... Must be one of: `['Rest', 'WEBHOOK']`.
- **`apiConnection`** *(object)*: API Service Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
