---
title: createTag
slug: /main-concepts/metadata-standard/schemas/api/classification/createtag
---

# CreateTagRequest

*Create tag API request*

## Properties

- **`classification`**: Name of the classification that this tag is part of. Refer to *../../entity/classification/tag.json#/definitions/tagName*.
- **`parent`**: Fully qualified name of the parent tag. When null, the term is at the root of the classification. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`name`**: Refer to *../../entity/classification/tag.json#/definitions/tagName*.
- **`displayName`** *(string)*: Display Name that identifies this tag.
- **`description`**: Unique name of the classification. Refer to *../../type/basic.json#/definitions/markdown*.
- **`associatedTags`** *(array)*: Fully qualified names of tags associated with this tag.
  - **Items** *(string)*
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`mutuallyExclusive`** *(boolean)*: Children tags under this group are mutually exclusive. When mutually exclusive is `true` the tags from this group are used to **classify** an entity. An entity can only be in one class - example, it can only be either `tier1` or `tier2` and not both. When mutually exclusive is `false`, the tags from this group are used to **categorize** an entity. An entity can be in multiple categories simultaneously - example a customer can be `newCustomer` and `atRisk` simultaneously. Default: `false`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
