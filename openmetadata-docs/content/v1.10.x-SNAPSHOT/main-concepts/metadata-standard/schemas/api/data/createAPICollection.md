---
title: createAPICollection
slug: /main-concepts/metadata-standard/schemas/api/data/createapicollection
---

# CreateAPICollectionRequest

*Create API Collection entity request*

## Properties

- **`name`**: Name that identifies this API Collection. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this API Collection. It could be title or label from the source services.
- **`description`**: Description of the API Collection instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`endpointURL`** *(string)*: EndPoint URL for the API Collection. Capture the Root URL of the collection.
- **`apiEndpoints`** *(array)*: All the API's fullyQualifiedNames included in this API Collection. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`tags`** *(array)*: Tags for this API Collection. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this API Collection. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`service`**: Link to the API service fully qualified name where this API collection is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`domains`** *(array)*: Fully qualified names of the domains the API Collection belongs to.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
