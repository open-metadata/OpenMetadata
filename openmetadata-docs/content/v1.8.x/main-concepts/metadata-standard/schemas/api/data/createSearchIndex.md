---
title: Create Search Index | OpenMetadata Search API
description: Create a search index entity to index specific fields or documents, enabling efficient and accurate metadata search functionality.
slug: /main-concepts/metadata-standard/schemas/api/data/createsearchindex
---

# CreateSearchIndexRequest

*Create a SearchIndex entity request*

## Properties

- **`name`**: Name that identifies this SearchIndex instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this SearchIndex.
- **`description`**: Description of the SearchIndex instance. What it has and how to use it. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`service`**: Fully qualified name of the search service where this searchIndex is hosted in. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`fields`** *(array)*: Fields in this SearchIndex. Default: `null`.
  - **Items**: Refer to *[../../entity/data/searchIndex.json#/definitions/searchIndexField](#/../entity/data/searchIndex.json#/definitions/searchIndexField)*.
- **`searchIndexSettings`**: Contains key/value pair of searchIndex settings. Refer to *[../../entity/data/searchIndex.json#/definitions/searchIndexSettings](#/../entity/data/searchIndex.json#/definitions/searchIndexSettings)*.
- **`indexType`**: Whether the entity is index or index template. Refer to *[../../entity/data/searchIndex.json#/definitions/indexType](#/../entity/data/searchIndex.json#/definitions/indexType)*. Default: `"Index"`.
- **`owners`**: Owners of this SearchIndex. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this SearchIndex. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`domain`** *(string)*: Fully qualified name of the domain the SearchIndex belongs to. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
