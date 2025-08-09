---
title: createSearchService
slug: /main-concepts/metadata-standard/schemas/api/services/createsearchservice
---

# CreateSearchServiceRequest

*Create Search Service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this search service. It could be title or label from the source services.
- **`description`**: Description of search service entity. Refer to *../../type/basic.json#/definitions/markdown*.
- **`serviceType`**: Refer to *../../entity/services/searchService.json#/definitions/searchServiceType*.
- **`connection`**: Refer to *../../entity/services/searchService.json#/definitions/searchConnection*.
- **`tags`** *(array)*: Tags for this Search Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this search service. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Search Service belongs to.
  - **Items** *(string)*
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
