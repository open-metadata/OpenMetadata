---
title: classification
slug: /main-concepts/metadata-standard/schemas/entity/classification/classification
---

# Classification

*This schema defines the Classification entity. A Classification contains tags called Primary Tags. Primary Tags can further have children Tags called Secondary Tags. Only two levels of tags are supported currently.*

## Properties

- **`id`**: Unique identifier of this entity instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Refer to *#/definitions/tagName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this tag category.
- **`description`**: Description of the tag category. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to the tag category. Refer to *../../type/basic.json#/definitions/href*.
- **`usageCount`** *(integer)*: Count of how many times the tags from this tag category are used.
- **`children`** *(array)*: Tags under this category.
  - **Items**: Refer to *#/definitions/tag*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`tagName`** *(string)*: Name of the tag.
- **`tag`**: Cannot contain additional properties.
  - **`id`**: Unique identifier of this entity instance. Refer to *../../type/basic.json#/definitions/uuid*.
  - **`name`**: Name of the tag. Refer to *#/definitions/tagName*.
  - **`displayName`** *(string)*: Display Name that identifies this tag category.
  - **`fullyQualifiedName`** *(string)*: Unique name of the tag of format Category.PrimaryTag.SecondaryTag.
  - **`description`**: Unique name of the tag category. Refer to *../../type/basic.json#/definitions/markdown*.
  - **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
  - **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
  - **`updatedBy`** *(string)*: User who made the update.
  - **`href`**: Link to the resource corresponding to the tag. Refer to *../../type/basic.json#/definitions/href*.
  - **`usageCount`** *(integer)*: Count of how many times this tag and children tags are used.
  - **`deprecated`** *(boolean)*: If the tag is deprecated. Default: `False`.
  - **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
  - **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
  - **`children`** *(array)*: Tags under this tag group or empty for tags at the leaf level.
    - **Items**: Refer to *#/definitions/tag*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
