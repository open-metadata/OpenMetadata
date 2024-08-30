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
- **`owner`**: Owner of this SearchIndex. Refer to *../../type/entityReference.json*.
- **`tags`** *(array)*: Tags for this SearchIndex. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`domain`** *(string)*: Fully qualified name of the domain the SearchIndex belongs to. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
