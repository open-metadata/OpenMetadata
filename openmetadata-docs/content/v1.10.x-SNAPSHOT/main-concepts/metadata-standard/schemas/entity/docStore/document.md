---
title: document
slug: /main-concepts/metadata-standard/schemas/entity/docstore/document
---

# Document

*This schema defines Document. A Generic entity to capture any kind of Json Payload.*

## Properties

- **`id`**: Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the DocStore. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this column name.
- **`fullyQualifiedName`**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`description`** *(string)*: Description of the DocStore Entity.
- **`entityType`** *(string)*: Type of the Entity stored in DocStore.
- **`data`**: Refer to *#/definitions/data*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`domains`**: Domains the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *../../type/entityReferenceList.json*.
## Definitions

- **`data`** *(object)*: Can contain additional properties.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
