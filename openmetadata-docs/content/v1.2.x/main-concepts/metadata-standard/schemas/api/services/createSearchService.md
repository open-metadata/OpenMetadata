---
title: createSearchService
slug: /main-concepts/metadata-standard/schemas/api/services/createsearchservice
---

# CreateSearchServiceRequest

*Create Search Service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this search service. It could be title or label from the source services.
- **`description`**: Description of search service entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/searchService.json#/definitions/searchServiceType](#/../entity/services/searchService.json#/definitions/searchServiceType)*.
- **`connection`**: Refer to *[../../entity/services/searchService.json#/definitions/searchConnection](#/../entity/services/searchService.json#/definitions/searchConnection)*.
- **`tags`** *(array)*: Tags for this Search Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owner`**: Owner of this search service. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Search Service belongs to.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
