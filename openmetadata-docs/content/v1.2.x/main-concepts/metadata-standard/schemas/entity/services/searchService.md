---
title: searchService
slug: /main-concepts/metadata-standard/schemas/entity/services/searchservice
---

# Search Service

*This schema defines the Search Service entity, such as ElasticSearch, OpenSearch.*

## Properties

- **`id`**: Unique identifier of this search service instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this search service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this search service.
- **`serviceType`**: Type of search service such as S3, GCS, AZURE... Refer to *[#/definitions/searchServiceType](#definitions/searchServiceType)*.
- **`description`**: Description of a search service instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`connection`**: Refer to *[#/definitions/searchConnection](#definitions/searchConnection)*.
- **`pipelines`**: References to pipelines deployed for this search service to extract metadata etc.. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *[connections/testConnectionResult.json](#nnections/testConnectionResult.json)*.
- **`tags`** *(array)*: Tags for this search Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this search service. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`owner`**: Owner of this search service. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`domain`**: Domain the search service belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- <a id="definitions/searchServiceType"></a>**`searchServiceType`** *(string)*: Type of search service such as ElasticSearch or OpenSearch. Must be one of: `["ElasticSearch", "OpenSearch", "CustomSearch"]`.
- <a id="definitions/searchConnection"></a>**`searchConnection`** *(object)*: search Connection. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[connections/search/elasticSearchConnection.json](#nnections/search/elasticSearchConnection.json)*.
      - : Refer to *[connections/search/openSearchConnection.json](#nnections/search/openSearchConnection.json)*.
      - : Refer to *[connections/search/customSearchConnection.json](#nnections/search/customSearchConnection.json)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
