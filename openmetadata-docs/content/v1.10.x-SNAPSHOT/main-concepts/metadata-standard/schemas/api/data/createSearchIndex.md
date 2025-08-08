---
title: createSearchIndex
slug: /main-concepts/metadata-standard/schemas/api/data/createsearchindex
---

# CreateSearchIndexRequest

*Create a SearchIndex entity request*

## Properties

- **`name`**: Name that identifies this SearchIndex instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this SearchIndex.
- **`description`**: Description of the SearchIndex instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`service`**: Fully qualified name of the search service where this searchIndex is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`fields`** *(array)*: Fields in this SearchIndex. Default: `None`.
  - **Items**: Refer to *../../entity/data/searchIndex.json#/definitions/searchIndexField*.
- **`searchIndexSettings`**: Contains key/value pair of searchIndex settings. Refer to *../../entity/data/searchIndex.json#/definitions/searchIndexSettings*.
- **`indexType`**: Whether the entity is index or index template. Refer to *../../entity/data/searchIndex.json#/definitions/indexType*. Default: `Index`.
- **`owners`**: Owners of this SearchIndex. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this SearchIndex. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`domains`** *(array)*: Fully qualified names of the domains the SearchIndex belongs to.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
