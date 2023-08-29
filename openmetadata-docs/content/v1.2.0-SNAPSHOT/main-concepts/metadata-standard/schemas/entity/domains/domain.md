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
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`parent`**: Parent domains. When 'null' or not set, indicates that this is the top level domain. Refer to *../../type/entityReference.json*.
- **`children`**: Children domains or subdomains  . Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*.
- **`owner`**: Owner of this Domain. Refer to *../../type/entityReference.json*.
- **`experts`**: List of of users who are experts in this Domain. Refer to *../../type/entityReferenceList.json#/definitions/entityReferenceList*. Default: `None`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
## Definitions

- **`domainType`** *(string)*: Type of a domain. Must be one of: `['Source-aligned', 'Consumer-aligned', 'Aggregate']`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
