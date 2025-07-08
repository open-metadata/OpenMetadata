---
title: Domain Schema | OpenMetadata Domain Schema and Details
slug: /main-concepts/metadata-standard/schemas/entity/domains/domain
---

# Domain

*A `Domain` is a bounded context that is aligned with a Business Unit or a function within an organization.*

## Properties

- **`id`**: Unique ID of the Domain. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`domainType`**: Domain type. Refer to *[#/definitions/domainType](#definitions/domainType)*.
- **`name`**: A unique name of the Domain. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Marketing', 'Payments', etc.
- **`description`**: Description of the Domain. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`style`**: Refer to *[../../type/basic.json#/definitions/style](#/../type/basic.json#/definitions/style)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`parent`**: Parent domains. When 'null' or not set, indicates that this is the top level domain. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`children`**: Children domains or sub-domains. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`owners`**: Owners of this Domain. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`experts`**: List of users who are experts in this Domain. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`assets`**: Data assets collection that is part of this domain. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
## Definitions

- **`domainType`** *(string)*: Type of a domain. Must be one of: `["Source-aligned", "Consumer-aligned", "Aggregate"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
