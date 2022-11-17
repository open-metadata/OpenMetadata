---
title: createTagCategory
slug: /main-concepts/metadata-standard/schemas/api/tags/createtagcategory
---

# CreateTagCategoryRequest

*Create tag category request*

## Properties

- **`name`**: Refer to *../../entity/tags/tagCategory.json#/definitions/tagName*.
- **`displayName`** *(string)*: Display Name that identifies this tag category.
- **`description`**: Description of the tag category. Refer to *../../type/basic.json#/definitions/markdown*.
- **`mutuallyExclusive`** *(boolean)*: Tags under this category are mutually exclusive. When mutually exclusive is `true` the tags from this category are used to **classify** an entity. An entity can only be in one class - example, it can only be either `tier1` or `tier2` and not both. When mutually exclusive is `false`, the tags from this category are used to **categorize** an entity. An entity can be in multiple categories simultaneously - example a customer can be `newCustomer` and `atRisk` simultaneously. Default: `false`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
