---
title: Create Search Service | OpenMetadata Search Service
description: Register a new search service to catalog and search metadata assets with configuration and indexing options.
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
- **`owners`**: Owners of this search service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Search Service belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
