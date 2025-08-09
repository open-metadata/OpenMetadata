---
title: classification
slug: /main-concepts/metadata-standard/schemas/entity/classification/classification
---

# Classification

*A `Classification` entity contains hierarchical terms called tags used for categorizing and classifying data assets and other entities.*

## Properties

- **`id`**: Unique identifier of this entity instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this entity.
- **`description`**: Description of the classification. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`termCount`** *(integer)*: Total number of children tag terms under this classification. This includes all the children in the hierarchy. Minimum: `0`.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to the classification. Refer to *../../type/basic.json#/definitions/href*.
- **`usageCount`** *(integer)*: Count of how many times the tags from this classification are used.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`disabled`** *(boolean)*: System classifications can't be deleted. Use this flag to disable them. Default: `False`.
- **`mutuallyExclusive`** *(boolean)*: Tags under this classification are mutually exclusive. When mutually exclusive is `true` the tags from this classification are used to **classify** an entity. An entity can only be in one class - example, it can only be either `tier1` or `tier2` and not both. When mutually exclusive is `false`, the tags from this classification are used to **categorize** an entity. An entity have multiple tags simultaneously - example a customer can be `newCustomer` and `atRisk` simultaneously. Default: `false`.
- **`domains`**: Domains the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *../../type/entityReferenceList.json*.
- **`owners`**: Owners of this Classification. Refer to *../../type/entityReferenceList.json*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
