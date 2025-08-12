---
title: domain
slug: /main-concepts/metadata-standard/schemas/entity/domains/domain
---

# Domain

*A `Domain` is a bounded context that is aligned with a Business Unit or a function within an organization.*

## Properties

- **`id`**: Unique ID of the Domain. Refer to *../../type/basic.json#/definitions/uuid*.
- **`domainType`**: Domain type. Refer to *#/definitions/domainType*.
- **`name`**: A unique name of the Domain. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Marketing', 'Payments', etc.
- **`description`**: Description of the Domain. Refer to *../../type/basic.json#/definitions/markdown*.
- **`style`**: Refer to *../../type/basic.json#/definitions/style*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`parent`**: Parent domains. When 'null' or not set, indicates that this is the top level domain. Refer to *../../type/entityReference.json*.
- **`children`**: Children domains or sub-domains. Refer to *../../type/entityReferenceList.json*.
- **`owners`**: Owners of this Domain. Refer to *../../type/entityReferenceList.json*.
- **`experts`**: List of users who are experts in this Domain. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`assets`**: Data assets collection that is part of this domain. Refer to *../../type/entityReferenceList.json*.
- **`tags`** *(array)*: Tags associated with the Domain. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
## Definitions

- **`domainType`** *(string)*: Type of a domain. Must be one of: `['Source-aligned', 'Consumer-aligned', 'Aggregate']`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
