---
title: searchService
slug: /main-concepts/metadata-standard/schemas/entity/services/searchservice
---

# Search Service

*This schema defines the Search Service entity, such as ElasticSearch, OpenSearch.*

## Properties

- **`id`**: Unique identifier of this search service instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies this search service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this search service.
- **`serviceType`**: Type of search service such as S3, GCS, AZURE... Refer to *#/definitions/searchServiceType*.
- **`description`**: Description of a search service instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`connection`**: Refer to *#/definitions/searchConnection*.
- **`pipelines`**: References to pipelines deployed for this search service to extract metadata etc.. Refer to *../../type/entityReferenceList.json*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *connections/testConnectionResult.json*.
- **`tags`** *(array)*: Tags for this search Service. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this search service. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this search service. Refer to *../../type/entityReferenceList.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`domains`**: Domains the search service belongs to. Refer to *../../type/entityReferenceList.json*.
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.
## Definitions

- **`searchServiceType`** *(string)*: Type of search service such as ElasticSearch or OpenSearch. Must be one of: `['ElasticSearch', 'OpenSearch', 'CustomSearch']`.
- **`searchConnection`** *(object)*: search Connection. Cannot contain additional properties.
  - **`config`**


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
