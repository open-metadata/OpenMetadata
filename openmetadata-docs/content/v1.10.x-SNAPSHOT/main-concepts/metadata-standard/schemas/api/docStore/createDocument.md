---
title: createDocument
slug: /main-concepts/metadata-standard/schemas/api/docstore/createdocument
---

# CreateDocumentRequest

*This schema defines Document. A Generic entity to capture any kind of Json Payload.*

## Properties

- **`name`**: Name of the DocStore. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this column name.
- **`fullyQualifiedName`**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`** *(string)*: Description of the DocStore Entity.
- **`entityType`** *(string)*: Type of the Entity stored in DocStore.
- **`data`**: Refer to *../../entity/docStore/document.json#/definitions/data*.
- **`domains`** *(array)*: Fully qualified names of the domains the Document belongs to.
  - **Items** *(string)*


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
